// Registry luu trang thai online + cuoc goi dang dien ra, hoan toan trong bo nho (in-memory).
//
// LUU Y: chi phu hop khi chay 1 instance server duy nhat. Neu sau nay scale ra nhieu
// instance (PM2 cluster, nhieu server dang sau load balancer) thi phai thay Map bang
// Redis (vi du dung @socket.io/redis-adapter cho phan broadcast, va Redis hash/set cho
// phan registry nay), vi moi instance hien dang giu state rieng, khong chia se cho nhau.

const userIdToSocketId = new Map();
const socketIdToUserId = new Map();

const activeCalls = new Map(); // callId -> { callerId, calleeId, status, createdAt, fromUser, callType }
const userIdToCallId = new Map(); // userId -> callId (dang trong 1 cuoc goi, ke ca luc dang "ringing")

// VoIP push token (PushKit, iOS) theo userId - dung de "danh thuc" may khi user dang offline
// (khong co socket dang ket noi) nhung co nguoi khac dang goi toi. Giu lai ke ca sau khi
// user disconnect (KHONG xoa trong unregisterSocket) vi luc do ho van co the nhan duoc cuoc
// goi den thong qua VoIP push, du app da bi kill.
const userIdToVoipToken = new Map();

function registerUser(userId, socketId) {
    const previousSocketId = userIdToSocketId.get(userId);
    if (previousSocketId && previousSocketId !== socketId) {
        // User da dang ky tu socket khac truoc do (vi du reconnect) -> don rac mapping cu
        socketIdToUserId.delete(previousSocketId);
    }
    userIdToSocketId.set(userId, socketId);
    socketIdToUserId.set(socketId, userId);
}

function unregisterSocket(socketId) {
    const userId = socketIdToUserId.get(socketId);
    if (!userId) return null;
    socketIdToUserId.delete(socketId);
    if (userIdToSocketId.get(userId) === socketId) {
        userIdToSocketId.delete(userId);
    }
    return userId;
}

function getSocketIdByUserId(userId) {
    return userIdToSocketId.get(userId);
}

function getUserIdBySocketId(socketId) {
    return socketIdToUserId.get(socketId);
}

function isUserOnline(userId) {
    return userIdToSocketId.has(userId);
}

function isUserBusy(userId) {
    return userIdToCallId.has(userId);
}

function startCall(callId, callerId, calleeId, extra = {}) {
    activeCalls.set(callId, {callerId, calleeId, status: 'ringing', createdAt: Date.now(), ...extra});
    userIdToCallId.set(callerId, callId);
    userIdToCallId.set(calleeId, callId);
}

function setVoipToken(userId, token) {
    if (!token) return;
    userIdToVoipToken.set(userId, token);
}

function getVoipToken(userId) {
    return userIdToVoipToken.get(userId);
}

function markCallAccepted(callId) {
    const call = activeCalls.get(callId);
    if (call) call.status = 'connected';
}

function endCall(callId) {
    const call = activeCalls.get(callId);
    if (!call) return null;
    activeCalls.delete(callId);
    userIdToCallId.delete(call.callerId);
    userIdToCallId.delete(call.calleeId);
    return call;
}

function getCall(callId) {
    const call = activeCalls.get(callId);
    return call ? {callId, ...call} : null;
}

function getCallByUserId(userId) {
    const callId = userIdToCallId.get(userId);
    return callId ? getCall(callId) : null;
}

module.exports = {
    registerUser,
    unregisterSocket,
    getSocketIdByUserId,
    getUserIdBySocketId,
    isUserOnline,
    isUserBusy,
    startCall,
    markCallAccepted,
    endCall,
    getCall,
    getCallByUserId,
    setVoipToken,
    getVoipToken,
};
