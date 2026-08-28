const http = require('http');
const express = require('express');
const cors = require('cors');
const {Server} = require('socket.io');

const config = require('./config/env');
const healthRoute = require('./routes/health');
const iceServersRoute = require('./routes/iceServers');
const {initSocket} = require('./socket');

const app = express();
app.use(cors({origin: config.corsOrigin}));
app.use(express.json());

app.use(healthRoute);
app.use(iceServersRoute);

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
    },
});

initSocket(io);

httpServer.listen(config.port, () => {
    console.log(`CallVideo signaling server dang chay tai port ${config.port}`);
});

process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
});
