const crypto = require('crypto');
const registry = require('./registry');
const apnsService = require('../services/apnsService');

function generateCallId() {
    return crypto.randomUUID();
}

function registerCallEvents(io, socket) {
    // --- Client dang ky userId cho socket nay, de nguoi khac co the goi toi ---
    socket.on('register', (payload = {}, ack) => {
        const {userId, voipToken} = payload;
        if (!userId) {
            if (ack) ack({ok: false, error: 'MISSING_USER_ID'});
            return;
        }
        const normalizedUserId = String(userId);
        registry.registerUser(normalizedUserId, socket.id);
        socket.data.userId = normalizedUserId;
        if (voipToken) {
            // Luu lai token push VoIP (PushKit, iOS) cua user nay - dung de danh thuc may ho
            // bang push khi co ai goi toi luc ho dang offline (xem call:invite ben duoi).
            registry.setVoipToken(normalizedUserId, voipToken);
        }
        console.log(`[socket] user ${userId} registered (${socket.id})`);
        if (ack) ack({ok: true});

        // User nay co the vua duoc VoIP push "danh thuc" (luc invite ho dang offline, server
        // da gui push va tao san 1 cuoc goi trang thai "ringing") - gio ho vua ket noi lai +
        // register, bao lai cho ho cuoc goi den ngay, vi luc invite server chua co socket nao
        // cua ho de emit truc tiep duoc.
        const pendingCall = registry.getCallByUserId(normalizedUserId);
        if (pendingCall && pendingCall.status === 'ringing' && pendingCall.calleeId === normalizedUserId) {
            socket.emit('call:incoming', {
                callId: pendingCall.callId,
                fromUser: pendingCall.fromUser,
                callType: pendingCall.callType,
            });
        }
    });

    // --- Nguoi goi khoi tao 1 cuoc goi moi (audio hoac video) ---
    socket.on('call:invite', (payload = {}, ack) => {
        const {toUserId, fromUser, callType} = payload;
        const fromUserId = socket.data.userId;

        if (!fromUserId) return ack && ack({ok: false, error: 'NOT_REGISTERED'});
        if (!toUserId) return ack && ack({ok: false, error: 'MISSING_TO_USER_ID'});

        const targetUserId = String(toUserId);

        if (registry.isUserBusy(fromUserId) || registry.isUserBusy(targetUserId)) {
            return ack && ack({ok: false, error: 'BUSY'});
        }

        const normalizedCallType = callType === 'video' ? 'video' : 'audio';
        const normalizedFromUser = fromUser || {id: fromUserId};
        const calleeSocketId = registry.getSocketIdByUserId(targetUserId);
        const calleeVoipToken = registry.getVoipToken(targetUserId);

        // Callee khong co socket dang ket noi (app dang bi kill/ngoai mang) VA cung khong co
        // voipToken da dang ky truoc do (chua tung login tren build co VoIP push) -> chiu,
        // khong co cach nao bao cho ho biet duoc.
        if (!calleeSocketId && !calleeVoipToken) {
            return ack && ack({ok: false, error: 'USER_OFFLINE'});
        }

        const callId = generateCallId();
        registry.startCall(callId, fromUserId, targetUserId, {
            fromUser: normalizedFromUser,
            callType: normalizedCallType,
        });

        if (calleeSocketId) {
            io.to(calleeSocketId).emit('call:incoming', {
                callId,
                fromUser: normalizedFromUser,
                callType: normalizedCallType,
            });
        } else {
            // Callee dang offline nhung co voipToken -> gui VoIP push (PushKit) de danh thuc
            // may ho, CallKit se tu hien UI cuoc goi den ke ca khi app da bi kill hoan toan.
            // Khi app ho tinh day, socket ket noi lai + register() se tu bao lai 'call:incoming'
            // (xem socket.on('register') o tren).
            apnsService.sendVoipPush(calleeVoipToken, {callId, fromUser: normalizedFromUser, callType: normalizedCallType})
                .then((res) => {
                    if (!res.ok) {
                        console.error(`[socket] gui VoIP push cho user ${targetUserId} that bai:`, res.error);
                    } else {
                        console.log(`[socket] da gui VoIP push danh thuc user ${targetUserId} (callId=${callId})`);
                    }
                });
        }

        if (ack) ack({ok: true, callId});
    });

    // --- Nguoi nhan bam chap nhan cuoc goi ---
    socket.on('call:accept', (payload = {}) => {
        const {callId} = payload;
        const call = registry.getCall(callId);
        if (!call) return;
        registry.markCallAccepted(callId);
        relayToOtherParty(call, 'call:accepted', {callId});
    });

    // --- Nguoi nhan tu choi cuoc goi ---
    socket.on('call:reject', (payload = {}) => {
        const {callId, reason} = payload;
        const call = registry.endCall(callId);
        if (!call) return;
        relayToOtherParty(call, 'call:rejected', {callId, reason});
    });

    // --- SDP offer / answer / ICE candidate: server chi relay nguyen ven, khong xu ly noi dung ---
    socket.on('call:offer', (payload = {}) => relayByCallId(payload, 'call:offer'));
    socket.on('call:answer', (payload = {}) => relayByCallId(payload, 'call:answer'));
    socket.on('call:ice-candidate', (payload = {}) => relayByCallId(payload, 'call:ice-candidate'));

    // --- Mot trong hai ben chu dong ket thuc cuoc goi ---
    socket.on('call:end', (payload = {}) => {
        const {callId} = payload;
        const call = registry.endCall(callId);
        if (!call) return;
        relayToOtherParty(call, 'call:ended', {callId});
    });

    // --- Nguoi dung LOGOUT THAT SU khoi app (bam nut dang xuat) - khac voi 'disconnect' o
    // duoi (mat mang/dong app/kill process): luc logout phai xoa han voipToken de thiet bi nay
    // KHONG CON nhan duoc cuoc goi/push cua tai khoan vua dang xuat nua (xem ghi chu trong
    // registry.clearVoipToken). Client goi event nay TRUOC khi disconnect socket.
    socket.on('logout', (payload = {}, ack) => {
        const userId = socket.data.userId;
        if (userId) {
            registry.clearVoipToken(userId);
            console.log(`[socket] user ${userId} logout - da xoa voipToken (${socket.id})`);
        }
        if (ack) ack({ok: true});
    });

    // --- Mat ket noi (rot mang, dong app, kill process...) ---
    socket.on('disconnect', () => {
        const userId = registry.unregisterSocket(socket.id);
        if (!userId) return;
        console.log(`[socket] user ${userId} disconnected (${socket.id})`);

        const call = registry.getCallByUserId(userId);
        if (call) {
            registry.endCall(call.callId);
            relayToOtherParty(call, 'call:ended', {callId: call.callId, reason: 'PEER_DISCONNECTED'}, userId);
        }
    });

    // Relay 1 event toi socket cua doi phuong trong cuoc goi `call`.
    // `excludeUserId` (mac dinh la user cua socket hien tai) se KHONG nhan lai chinh event minh gui.
    function relayToOtherParty(call, event, payload, excludeUserId = socket.data.userId) {
        const otherUserId = call.callerId === excludeUserId ? call.calleeId : call.callerId;
        const otherSocketId = registry.getSocketIdByUserId(otherUserId);
        if (otherSocketId) io.to(otherSocketId).emit(event, payload);
    }

    function relayByCallId(payload, event) {
        const {callId} = payload || {};
        const call = registry.getCall(callId);
        if (!call) return;
        relayToOtherParty(call, event, payload);
    }
}

module.exports = {registerCallEvents};
