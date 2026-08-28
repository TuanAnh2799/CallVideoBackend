const express = require('express');
const {getIceServers} = require('../config/iceServers');

const router = express.Router();

// Client goi endpoint nay truoc khi tao RTCPeerConnection de lay danh sach STUN/TURN hien hanh
// (TURN credential co the la ngan han, sinh moi cho tung lan goi - xem src/config/iceServers.js)
router.get('/ice-servers', (req, res) => {
    res.json({iceServers: getIceServers()});
});

module.exports = router;
