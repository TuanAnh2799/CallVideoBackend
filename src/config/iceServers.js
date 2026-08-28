const crypto = require('crypto');
const config = require('./env');

// Sinh credential TURN ngan han theo chuan REST API cua coturn (static-auth-secret):
// username = unix timestamp het han, credential = base64(HMAC-SHA1(secret, username))
// https://github.com/coturn/coturn/blob/master/README.turnserver
function generateTurnCredential() {
    if (config.turnStaticAuthSecret) {
        const expiresAt = Math.floor(Date.now() / 1000) + config.turnCredentialTtlSeconds;
        const username = `${expiresAt}`;
        const credential = crypto
            .createHmac('sha1', config.turnStaticAuthSecret)
            .update(username)
            .digest('base64');
        return {username, credential};
    }

    // Fallback: dung username/credential co dinh (khai bao trong .env) neu coturn khong bat static-auth-secret
    return {username: config.turnUsername, credential: config.turnCredential};
}

function getIceServers() {
    const iceServers = [{urls: config.stunUrl}];

    if (config.turnUrl) {
        const {username, credential} = generateTurnCredential();
        iceServers.push({
            urls: config.turnUrl,
            username,
            credential,
        });
    }

    return iceServers;
}

module.exports = {getIceServers, generateTurnCredential};
