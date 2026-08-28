# CallVideoServer

Signaling server cho tinh nang goi video/goi thoai cua app Hunonic. Server nay KHONG truyen
video/audio (do la P2P giua 2 client qua WebRTC) - no chi lam nhiem vu "moi" (matchmaking) va
chuyen tiep SDP offer/answer + ICE candidate giua hai may.

Day la project doc lap, tach rieng khoi repo `app-hunonic` (mobile app), co the deploy rieng
len VPS, co vong doi/CI-CD rieng.

## Kien truc lien quan

- Client (app-hunonic): `react-native-webrtc`, `react-native-incall-manager`,
  `react-native-callkeep`, `socket.io-client`.
- Signaling server (o day): Node.js + Express + Socket.io.
- NAT traversal: Google STUN (mien phi) + Coturn TURN server (tu cai tren VPS Ubuntu).

## Cai dat

```bash
npm install
cp .env.example .env
# chinh sua .env: PORT, CORS_ORIGIN, TURN_*, AUTH_SECRET...
npm run dev   # chay voi nodemon, tu reload khi sua code
# hoac
npm start     # chay production
```

## Bien moi truong (.env)

| Bien | Y nghia |
|---|---|
| `PORT` | Cong HTTP/Socket.io server lang nghe |
| `CORS_ORIGIN` | Origin duoc phep goi (mac dinh `*`) |
| `AUTH_SECRET` | Neu de trong, server chay KHONG xac thuc (chi dung dev). Xem `src/socket/auth.js` |
| `STUN_URL` | STUN server, mac dinh dung Google STUN mien phi |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | TURN server + credential co dinh |
| `TURN_STATIC_AUTH_SECRET`, `TURN_CREDENTIAL_TTL_SECONDS` | Neu coturn bat `static-auth-secret`, server tu sinh credential TURN ngan han (khuyen nghi hon credential co dinh) |

## Viec CAN LAM truoc khi len production

1. **Xac thuc that**: `src/socket/auth.js` hien la placeholder (chi kiem tra token co ton tai,
   khong verify that). Phai thay bang xac thuc that voi he thong tai khoan Hunonic hien co
   (JWT hoac goi API kiem tra `token_id`) truoc khi dua len production.
2. **Coturn**: cai coturn tren 1 VPS Ubuntu rieng (khong chung voi server nay cung duoc, nhung
   nen dat gan ve mang), bat `static-auth-secret` de sinh credential ngan han thay vi dung
   username/password co dinh mai mai.
3. **HTTPS/WSS**: khi deploy that, dat server sau Nginx/Caddy voi TLS (bat buoc voi iOS/CallKit
   va de tranh browser/OS chan ket noi khong ma hoa).
4. **Scale nhieu instance**: hien `src/socket/registry.js` luu state trong bo nho (Map), chi
   chay dung voi 1 instance. Muon chay nhieu instance sau load balancer thi phai chuyen sang
   Redis (`@socket.io/redis-adapter` + Redis hash/set thay cho Map).

## Giao thuc socket (event) — client <-> server

Client ket noi socket.io kem `auth: { token }`, sau do:

### 1. `register` (client -> server, co ack)
```js
socket.emit('register', { userId: '123' }, (res) => {
  // res: { ok: true } | { ok: false, error }
});
```
Goi ngay sau khi ket noi (va sau moi lan reconnect) de nguoi khac co the goi toi minh.

### 2. Nguoi goi khoi tao cuoc goi — `call:invite` (co ack tra ve `callId`)
```js
socket.emit('call:invite', {
  toUserId: '456',
  fromUser: { id: '123', name: 'Nguyen Van A' },
  callType: 'video', // 'video' | 'audio'
}, (res) => {
  // res: { ok: true, callId } | { ok: false, error: 'USER_OFFLINE' | 'BUSY' | ... }
});
```

### 3. Nguoi nhan duoc bao co cuoc goi den — `call:incoming` (server -> callee)
```js
socket.on('call:incoming', ({ callId, fromUser, callType }) => {
  // hien man hinh/CallKit incoming call
});
```

### 4. Nguoi nhan phan hoi
```js
socket.emit('call:accept', { callId });               // -> ben kia nhan 'call:accepted'
socket.emit('call:reject', { callId, reason: 'busy' }); // -> ben kia nhan 'call:rejected'
```

### 5. Trao doi WebRTC (SDP + ICE) — server chi relay nguyen ven theo `callId`
```js
socket.emit('call:offer', { callId, sdp });
socket.emit('call:answer', { callId, sdp });
socket.emit('call:ice-candidate', { callId, candidate });

socket.on('call:offer', ({ callId, sdp }) => { /* setRemoteDescription */ });
socket.on('call:answer', ({ callId, sdp }) => { /* setRemoteDescription */ });
socket.on('call:ice-candidate', ({ callId, candidate }) => { /* addIceCandidate */ });
```

### 6. Ket thuc cuoc goi
```js
socket.emit('call:end', { callId }); // -> ben kia nhan 'call:ended'
```
Server cung tu dong ban 'call:ended' toi ben con lai neu 1 ben mat ket noi giua chung.

### 7. Lay danh sach ICE server (STUN/TURN) — REST, khong qua socket
```
GET /ice-servers
-> { "iceServers": [ { "urls": "stun:..." }, { "urls": "turn:...", "username", "credential" } ] }
```
Goi truoc khi tao `RTCPeerConnection` o client.

### 8. Health check
```
GET /health -> { ok: true, uptime, timestamp }
```
