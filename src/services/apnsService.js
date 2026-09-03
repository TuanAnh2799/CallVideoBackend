const config = require('../config/env');

// Provider APNs (HTTP/2, dung Auth Key .p8) - khoi tao 1 lan duy nhat, dung lai cho moi
// lan gui push (khong tao provider moi moi lan gui, ton ket noi).
let provider = null;
let providerInitFailed = false;

function getProvider() {
    if (!config.apns.enabled || providerInitFailed) return null;
    if (provider) return provider;

    try {
        const apn = require('@parse/node-apn');
        provider = new apn.Provider({
            token: {
                key: config.apns.keyPath, // duong dan file .p8 (APNs Auth Key) tai vao may/VPS
                keyId: config.apns.keyId,
                teamId: config.apns.teamId,
            },
            production: config.apns.production,
        });
        return provider;
    } catch (e) {
        providerInitFailed = true;
        console.error('[apns] khong khoi tao duoc APNs provider (kiem tra APNS_KEY_PATH co dung file .p8 khong):', e.message);
        return null;
    }
}

// Gui 1 VoIP push (silent, khong co alert/sound/badge) toi 1 thiet bi iOS - dung de "danh
// thuc" app nhan cuoc goi den ke ca khi app da bi kill hoan toan. App PHAI tu hien UI cuoc
// goi qua CallKit ngay khi nhan duoc push nay (xem AppDelegate.mm phia app-hunonic).
async function sendVoipPush(voipToken, {callId, fromUser, callType}) {
    if (!voipToken) return {ok: false, error: 'MISSING_VOIP_TOKEN'};

    const apnProvider = getProvider();
    if (!apnProvider) return {ok: false, error: 'APNS_NOT_CONFIGURED'};

    const apn = require('@parse/node-apn');
    const notification = new apn.Notification();
    notification.topic = `${config.apns.bundleId}.voip`;
    notification.pushType = 'voip';
    notification.priority = 10;
    notification.expiry = Math.floor(Date.now() / 1000) + 30; // cuoc goi het "y nghia" sau 30s neu chua toi duoc may
    notification.payload = {callId, fromUser, callType};

    try {
        const result = await apnProvider.send(notification, voipToken);
        if (result.failed && result.failed.length > 0) {
            const failure = result.failed[0];
            console.error('[apns] gui VoIP push that bai:', failure?.response || failure?.error || failure);
            return {ok: false, error: failure?.response?.reason || 'APNS_SEND_FAILED'};
        }
        return {ok: true};
    } catch (e) {
        console.error('[apns] loi khi gui VoIP push:', e);
        return {ok: false, error: 'APNS_EXCEPTION'};
    }
}

module.exports = {sendVoipPush};
