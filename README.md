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

## Chay server

### 1. Chay local (dev)

```bash
npm install
cp .env.example .env   # neu chua co file .env
npm run dev
```

`npm run dev` dung `nodemon`, tu dong restart server moi khi sua code trong `src/`.
Mac dinh server lang nghe tren cong khai bao trong `.env` (bien `PORT`, vi du `4000`).

### 2. Chay production

```bash
npm install --omit=dev
npm start
```

`npm start` chay truc tiep bang `node src/index.js`, khong tu reload — dung cho moi truong
production (VPS/server that). Nen chay qua process manager (vi du `pm2 start src/index.js
--name callvideo-server`) de server tu khoi dong lai neu crash hoac khi reboot may.

### 3. Kiem tra server da chay

```bash
curl http://localhost:4000/health
# -> { "ok": true, "uptime": ..., "timestamp": ... }
```

(Doi `4000` thanh gia tri `PORT` thuc te trong `.env` neu ban da doi.)

## Bien moi truong (.env)

| Bien | Y nghia |
|---|---|
| `PORT` | Cong HTTP/Socket.io server lang nghe |
| `CORS_ORIGIN` | Origin duoc phep goi (mac dinh `*`) |
| `AUTH_SECRET` | Neu de trong, server chay KHONG xac thuc (chi dung dev). Xem `src/socket/auth.js` |
| `STUN_URL` | STUN server, mac dinh dung Google STUN mien phi |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | TURN server + credential co dinh |
| `TURN_STATIC_AUTH_SECRET`, `TURN_CREDENTIAL_TTL_SECONDS` | Neu coturn bat `static-auth-secret`, server tu sinh credential TURN ngan han (khuyen nghi hon credential co dinh) |
| `APNS_KEY_PATH`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION` | Cau hinh APNs Auth Key (.p8) de gui VoIP Push (PushKit) cho iOS - de trong thi tinh nang "nhan cuoc goi khi app bi kill" khong hoat dong. Xem muc rieng ben duoi. |
| `FCM_SERVICE_ACCOUNT_PATH` | Cau hinh Service Account (.json) de gui FCM data message cho Android - de trong thi tinh nang "nhan cuoc goi khi app bi kill" khong hoat dong tren Android. Xem muc rieng ben duoi. |

## Nhan cuoc goi khi app da bi kill (iOS - VoIP Push / PushKit, Android - FCM)

Mac dinh, tinh nang goi video chi hoat dong khi app dang mo (foreground/background) va con
giu duoc ket noi socket.io toi server nay. Neu nguoi dung gat app di (kill hoan toan), socket
ngat ngay lap tuc va server KHONG CO CACH NAO bao cho ho biet co cuoc goi den - remote
notification thong thuong cung khong danh thuc duoc app da bi kill.

Cach duy nhat Apple cho phep de giai quyet: **VoIP Push (PushKit)**. Phia app (`app-hunonic`)
da duoc tich hop san (xem `AppDelegate.mm`, `CallManager.js`). Phia server nay da co san logic
gui push qua `src/services/apnsService.js` va tu dong bao lai `call:incoming` khi callee vua
online tro lai sau khi bi danh thuc (xem `socket.on('register')` trong `callEvents.js`).

**De tinh nang nay hoat dong thuc su, can lam them cac buoc sau (thu cong, ngoai code):**

1. **Tao APNs Auth Key**: vao [Apple Developer](https://developer.apple.com/account) >
   Certificates, Identifiers & Profiles > Keys > bam "+" > tick "Apple Push Notifications
   service (APNs)" > Continue > Register. Tai ve file `.p8` (**chi tai duoc 1 lan duy nhat**,
   luu can than) va ghi lai **Key ID**.
2. **Team ID**: xem o trang Membership cua Apple Developer.
3. Dat 5 bien trong `.env` (xem bang bien moi truong o tren): `APNS_KEY_PATH` (duong dan toi
   file `.p8` vua tai, copy vao server/VPS), `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`
   (bundle id cua app, KHONG kem `.voip`), `APNS_PRODUCTION` (`false` khi test bang build debug
   qua Xcode, `true` khi build production/TestFlight/App Store).
4. **Phia app**: chay `yarn add react-native-voip-push-notification` roi `cd ios && pod
   install`, sau do build lai app tu Xcode (thay doi native code khong the Fast Refresh duoc -
   phai build lai hoan toan).
5. Test: mo app, login (de app dang ky voipToken len server), **gat app di (kill hoan toan)**,
   roi dung may khac goi toi - man hinh cuoc goi den kieu CallKit (toan man hinh, giong cuoc
   goi thuong cua iOS) phai tu hien len du app dang khong chay.

Neu khong cau hinh APNs (de trong cac bien tren), server se tu dong bo qua buoc gui VoIP push
(chi log loi `APNS_NOT_CONFIGURED`) - goi video van hoat dong binh thuong khi ca 2 app deu
dang mo, chi khong "danh thuc" duoc app da bi kill.

### Android - FCM data message

Co che tuong tu nhung dung FCM (Firebase Cloud Messaging) thay vi PushKit, vi Android khong
co API rieng cho VoIP push nhu iOS. Phia app da tich hop san (xem `index.js` -
`setBackgroundMessageHandler`, `CallManager.js` - `setupFcmToken`/`handleBackgroundIncomingCallPush`).
Phia server da co san logic gui push qua `src/services/fcmService.js`, dung chung co che
"tu dong bao lai `call:incoming` khi callee vua online tro lai" voi iOS (`socket.on('register')`
trong `callEvents.js`).

**De tinh nang nay hoat dong thuc su, can lam them cac buoc sau (thu cong, ngoai code):**

1. **Tao Firebase Service Account key**: vao [Firebase Console](https://console.firebase.google.com)
   > chon project cua app-hunonic > banh rang Project settings > tab "Service accounts" >
   "Generate new private key". Tai ve file `.json` (**giu can than, day la private key that
   su**), copy vao thu muc `secrets/` cua server (giong cach lam voi file `.p8`).
2. Dat bien `FCM_SERVICE_ACCOUNT_PATH` trong `.env` tro toi file `.json` vua tai.
3. **Phia app**: da co san `@react-native-firebase/messaging` + `google-services.json` trong
   project (khong can cai them goi nao), chi can build lai tu Android Studio/`react-native
   run-android` (thay doi native-adjacent nhu `index.js` can reload/rebuild hoan toan, khong
   the Fast Refresh).
4. Test: mo app, login (de app dang ky fcmToken len server), **gat app di (kill hoan toan tu
   danh sach da nhiem, khong chi bam Home)**, roi dung may khac goi toi - UI cuoc goi den qua
   CallKeep phai tu hien len du app dang khong chay.

**Luu y quan trong khi test:** app hien dang co san 1 service xu ly FCM khac
(`RNPushNotificationListenerService` cua thu vien `react-native-push-notification`, dung cho
cac thong bao thuong khac cua app) cung khai bao nhan `com.google.firebase.MESSAGING_EVENT`
trong `AndroidManifest.xml` - trung voi service ma `@react-native-firebase/messaging` tu dong
khai bao (`ReactNativeFirebaseMessagingService`). Ve nguyen tac day la 2 API rieng biet nen
thuong khong xung dot, nhung Android/Firebase co the xu ly khac nhau tuy phien ban khi co 2
service cung nhan 1 loai su kien nhu vay trong cung 1 app. Neu test thay app KHONG duoc danh
thuc (khong thay log `[index] setBackgroundMessageHandler nhan duoc message` trong
`adb logcat` luc app da kill ma co cuoc goi toi), day la nghi van dau tien can kiem tra.

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
socket.emit('register', {
  userId: '123',
  voipToken: '<PushKit voip token, chi iOS>',   // tuy chon
  fcmToken: '<FCM token, chi Android>',          // tuy chon
}, (res) => {
  // res: { ok: true } | { ok: false, error }
});
```
Goi ngay sau khi ket noi (va sau moi lan reconnect) de nguoi khac co the goi toi minh.
`voipToken`/`fcmToken` la tuy chon - 1 client chi gui 1 trong 2 tuy platform, dung de server
gui push danh thuc may khi co cuoc goi toi luc app dang bi kill (xem muc "Nhan cuoc goi khi
app bi kill" ben duoi).

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
