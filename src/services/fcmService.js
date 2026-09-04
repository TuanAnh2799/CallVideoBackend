// firebase-admin v12+ da doi sang "modular API" (giong firebase JS SDK phia web/client) -
// KHONG con dung duoc admin.credential.cert()/admin.messaging(app) kieu namespace cu nua (goi
// nhu vay se loi "Cannot read properties of undefined (reading 'cert')" vi admin.credential
// khong con ton tai). Phai import rieng tung ham can dung tu 'firebase-admin/app' va
// 'firebase-admin/messaging'.
const {initializeApp, cert} = require('firebase-admin/app');
const {getMessaging} = require('firebase-admin/messaging');
const config = require('../config/env');

// App Firebase Admin (dat ten rieng 'callvideo-fcm' de khong dung app mac dinh, tranh xung
// dot neu sau nay project co dung Firebase Admin cho viec khac) - khoi tao 1 lan duy nhat,
// dung lai cho moi lan gui push (giong pattern cua apnsService.js).
let fcmApp = null;
let initFailed = false;

function getFcmApp() {
    if (!config.fcm.enabled || initFailed) return null;
    if (fcmApp) return fcmApp;

    try {
        // cert() nhan truc tiep duong dan file JSON (tu doc + parse ben trong), duong dan
        // tinh theo thu muc dang chay "node src/index.js" (process.cwd()), giong cach
        // APNS_KEY_PATH dang hoat dong.
        fcmApp = initializeApp(
            {credential: cert(config.fcm.serviceAccountPath)},
            'callvideo-fcm'
        );
        return fcmApp;
    } catch (e) {
        initFailed = true;
        console.error('[fcm] khong khoi tao duoc Firebase Admin (kiem tra FCM_SERVICE_ACCOUNT_PATH co dung file JSON khong):', e.message);
        return null;
    }
}

// Gui 1 push "danh thuc" toi thiet bi Android qua FCM - dung khi callee dang offline (khong
// co socket dang ket noi) nhung co nguoi khac dang goi toi, de app khoi dong lai (ke ca da bi
// kill hoan toan) va tu hien UI cuoc goi qua CallKeep (xem index.js phia app-hunonic - noi
// dang ky setBackgroundMessageHandler).
//
// LUU Y quan trong: CHI dung "data" message, KHONG dat truong "notification" - neu co
// "notification", he thong Android se TU DONG hien 1 thong bao mac dinh (khong kiem soat
// duoc noi dung/hanh vi), de len tren UI CallKeep ma app tu ve, gay ra tinh trang 2 lop UI
// giong nhu da gap voi cuoc goi den luc app dang song. "priority: high" la bat buoc de FCM
// danh thuc duoc app ke ca dang o Doze mode / da bi he thong dung.
async function sendCallPush(fcmToken, {callId, fromUser, callType}) {
    if (!fcmToken) return {ok: false, error: 'MISSING_FCM_TOKEN'};

    const app = getFcmApp();
    if (!app) return {ok: false, error: 'FCM_NOT_CONFIGURED'};

    const message = {
        token: fcmToken,
        data: {
            type: 'incoming_call',
            callId: String(callId),
            fromUser: JSON.stringify(fromUser || {}),
            callType: String(callType || 'video'),
        },
        android: {
            priority: 'high',
        },
    };

    try {
        await getMessaging(app).send(message);
        return {ok: true};
    } catch (e) {
        console.error('[fcm] gui push that bai:', e?.errorInfo?.message || e.message);
        return {ok: false, error: e?.errorInfo?.code || 'FCM_SEND_FAILED'};
    }
}

module.exports = {sendCallPush};
