require('dotenv').config();

const config = {
    port: parseInt(process.env.PORT, 10) || 4000,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    authSecret: process.env.AUTH_SECRET || '',

    stunUrl: process.env.STUN_URL || 'stun:stun.l.google.com:19302',

    turnUrl: process.env.TURN_URL || '',
    turnUsername: process.env.TURN_USERNAME || '',
    turnCredential: process.env.TURN_CREDENTIAL || '',

    turnStaticAuthSecret: process.env.TURN_STATIC_AUTH_SECRET || '',
    turnCredentialTtlSeconds: parseInt(process.env.TURN_CREDENTIAL_TTL_SECONDS, 10) || 86400,

    // === APNs VoIP Push (PushKit, iOS) - danh thuc app nhan cuoc goi den ke ca khi da bi kill ===
    apns: {
        keyPath: process.env.APNS_KEY_PATH || '',
        keyId: process.env.APNS_KEY_ID || '',
        teamId: process.env.APNS_TEAM_ID || '',
        bundleId: process.env.APNS_BUNDLE_ID || '',
        production: (process.env.APNS_PRODUCTION || 'false').toLowerCase() === 'true',
        get enabled() {
            return !!(this.keyPath && this.keyId && this.teamId && this.bundleId);
        },
    },
};

module.exports = config;
