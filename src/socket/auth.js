const config = require('../config/env');

// TODO: thay bang xac thuc that cua he thong Hunonic truoc khi len production, vi du:
//  - Neu Hunonic phat hanh JWT: verify bang thu vien "jsonwebtoken" + AUTH_SECRET dung chung.
//  - Neu Hunonic dung token_id tra cuu qua API/DB (nhu token_id dang dung trong app-hunonic
//    hien tai): goi sang API backend hien co de kiem tra token_id + lay user_id tuong ung.
// Hien tai ham nay CHUA xac thuc that, chi kiem tra token co duoc gui len hay khong.
async function verifyAuthToken(token) {
    if (!config.authSecret) {
        // Che do dev/local: bo qua xac thuc. KHONG duoc dung o production.
        return {ok: true, skipped: true};
    }
    if (!token) {
        return {ok: false};
    }
    // Placeholder - can thay the bang logic xac thuc that.
    return {ok: true};
}

function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    verifyAuthToken(token)
        .then((result) => {
            if (!result.ok) {
                next(new Error('UNAUTHORIZED'));
                return;
            }
            if (result.skipped) {
                console.warn(
                    '[socket] AUTH_SECRET chua duoc cau hinh - dang chay KHONG xac thuc. ' +
                    'Chi nen dung o moi truong dev, phai cau hinh xac thuc that truoc khi len production.'
                );
            }
            next();
        })
        .catch((error) => {
            console.error('[socket] loi xac thuc:', error);
            next(new Error('UNAUTHORIZED'));
        });
}

module.exports = {socketAuthMiddleware, verifyAuthToken};
