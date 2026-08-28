// Registry luu trang thai online + cuoc goi dang dien ra, hoan toan trong bo nho (in-memory).
//
// LUU Y: chi phu hop khi chay 1 instance server duy nhat. Neu sau nay scale ra nhieu
// instance (PM2 cluster, nhieu server dang sau load balancer) thi phai thay Map bang
// Redis (vi du dung @socket.io/redis-adapter cho phan broadcast, va Redis hash/set cho
// phan registry nay), vi moi instance hien dang giu state rieng, khong chia se cho nhau.

const userIdToSocketId = new Map();
const socketIdToUserId = new Map();

const activeCalls = new Map(); // callId -> { callerId, calleeId, status, createdAt }
const userIdToCallId = new Map(); // userId -> callId (dang trong 1 cuoc goi, ke ca luc dang "ringing")

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

function startCall(callId, callerId, calleeId) {
    activeCalls.set(callId, {callerId, calleeId, status: 'ringing', createdAt: Date.now()});
    userIdToCallId.set(callerId, callId);
    userIdToCallId.set(calleeId, callId);
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
};
