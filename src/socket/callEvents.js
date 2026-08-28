const crypto = require('crypto');
const registry = require('./registry');

function generateCallId() {
    return crypto.randomUUID();
}

function registerCallEvents(io, socket) {
    // --- Client dang ky userId cho socket nay, de nguoi khac co the goi toi ---
    socket.on('register', (payload = {}, ack) => {
        const {userId} = payload;
        if (!userId) {
            if (ack) ack({ok: false, error: 'MISSING_USER_ID'});
            return;
        }
        registry.registerUser(String(userId), socket.id);
        socket.data.userId = String(userId);
        console.log(`[socket] user ${userId} registered (${socket.id})`);
        if (ack) ack({ok: true});
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

        const calleeSocketId = registry.getSocketIdByUserId(targetUserId);
        if (!calleeSocketId) {
            return ack && ack({ok: false, error: 'USER_OFFLINE'});
        }

        const callId = generateCallId();
        registry.startCall(callId, fromUserId, targetUserId);

        io.to(calleeSocketId).emit('call:incoming', {
            callId,
            fromUser: fromUser || {id: fromUserId},
            callType: callType === 'video' ? 'video' : 'audio',
        });

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
