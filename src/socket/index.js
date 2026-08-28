const {socketAuthMiddleware} = require('./auth');
const {registerCallEvents} = require('./callEvents');

function initSocket(io) {
    io.use(socketAuthMiddleware);

    io.on('connection', (socket) => {
        console.log(`[socket] connected: ${socket.id}`);
        registerCallEvents(io, socket);
    });
}

module.exports = {initSocket};
