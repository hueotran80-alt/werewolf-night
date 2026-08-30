# Hướng dẫn: Đưa "Ma Sói: Đêm Lừa Dối" lên Cloud + Đóng gói App Android

Tài liệu này hướng dẫn 2 việc, làm theo đúng thứ tự:

1. **Triển khai máy chủ (server.ts) lên một dịch vụ cloud** — đây chính là
   "mạng trung gian" mà mọi người chơi (dù ở mạng wifi, 4G, hay quốc gia
   khác nhau) đều kết nối vào. Nhờ vậy hai người ở hai mạng khác nhau vẫn
   luôn thấy được cùng một phòng chơi, một trận đấu.
2. **Đóng gói giao diện web hiện có thành 1 file APK Android thật** bằng
   Capacitor, để cấu hình sẵn (hoặc cho phép người chơi tự nhập) địa chỉ
   máy chủ cloud ở bước 1.

Kiến trúc game này **vốn đã là kiến trúc máy chủ trung tâm (authoritative
server)** — mọi hành động, chia bài, xử lý đêm/ngày, chat, tín hiệu thoại
đều đi qua `server.ts` (Express + WebSocket). Vấn đề duy nhất trước đây là
app "đoán" địa chỉ server bằng `window.location`, chỉ đúng khi tự mở app
ngay trên máy chủ đó. Bản chỉnh sửa này thêm một lớp cấu hình
(`src/lib/serverConfig.ts`) để bạn khai báo rõ địa chỉ cloud, dùng được cho
cả bản web lẫn bản Android đóng gói.

---

## PHẦN 1 — Triển khai máy chủ lên Cloud

Ví dụ dùng **Render.com** (có gói miễn phí, dễ dùng nhất). Railway, Fly.io,
hoặc VPS riêng (VD DigitalOcean) đều dùng chung nguyên lý.

1. Đẩy toàn bộ thư mục dự án này (đã chỉnh sửa) lên một repo GitHub/GitLab.
2. Vào [render.com](https://render.com) → **New** → **Web Service** → chọn
   repo vừa tạo.
3. Cấu hình:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** Node
   - Không cần khai báo `PORT` — Render tự cấp, `server.ts` đã đọc
     `process.env.PORT` (đã sửa sẵn trong bản này).
4. Bấm Deploy. Sau khi build xong, Render cấp cho bạn 1 domain dạng:
   `https://ten-app-cua-ban.onrender.com`
5. Kiểm tra server sống chưa bằng cách mở:
   `https://ten-app-cua-ban.onrender.com/api/health`
   → phải trả về JSON `{ "status": "ok", ... }`.

> Lưu ý: gói miễn phí của Render sẽ "ngủ" sau ~15 phút không ai truy cập,
> lần request đầu tiên sau đó có thể mất 30–60 giây để tỉnh dậy. Nếu cần
> chạy ổn định 24/7 cho nhóm chơi thường xuyên, nên nâng gói trả phí hoặc
> chuyển sang VPS riêng.

### Voice chat (thoại) hoạt động thế nào qua mạng khác nhau?

Bản chỉnh sửa này đã bổ sung **WebRTC thật** (trước đây chỉ có UI, chưa
truyền được tiếng nói). Máy chủ cloud ở trên đóng vai trò "người giới
thiệu" (signaling: chuyển tiếp gói tin mời gọi/ trả lời giữa 2 máy), sau đó
âm thanh sẽ truyền trực tiếp giữa 2 máy người chơi (peer-to-peer) để giảm
độ trễ. Với đa số mạng gia đình/4G, chỉ cần STUN công cộng (đã cấu hình sẵn
trong `src/services/voiceService.ts`) là đủ kết nối được.

Với một số mạng công ty/trường học chặn khắt khe (symmetric NAT), kết nối
trực tiếp có thể thất bại và cần thêm **TURN server** (máy trung chuyển âm
thanh luôn, không chỉ giới thiệu). Nếu gặp tình trạng "chat chữ được nhưng
không nghe được tiếng nhau", hãy:

1. Đăng ký một dịch vụ TURN miễn phí/trả phí (VD Metered.ca, Twilio, Xirsys)
   hoặc tự cài `coturn` trên VPS.
2. Trong app, sau khi đăng nhập, mở Console trình duyệt (bản web) và chạy:
   ```js
   localStorage.setItem('werewolf_turn_config', JSON.stringify({
     urls: 'turn:your-turn-host:3478',
     username: 'xxx',
     credential: 'yyy',
   }));
   ```
   (Với bản Android, có thể thêm 1 ô nhập TURN vào màn Cài Đặt tương tự ô
   máy chủ cloud nếu bạn muốn — cấu trúc đã sẵn sàng ở `voiceService.ts`.)

---

## PHẦN 2 — Đóng gói thành App Android (Capacitor)

Việc build APK cần Android Studio + Android SDK, **bắt buộc phải chạy trên
máy tính của bạn** (Windows/Mac/Linux có cài Android Studio), không thể tạo
sẵn ở đây. Toàn bộ cấu hình cần thiết (Capacitor) đã được thêm vào project.

### Bước 1: Cài công cụ

```bash
# Cài Node.js 18+ nếu chưa có, rồi trong thư mục project:
npm install
```

### Bước 2: (Tuỳ chọn) Đóng đinh sẵn địa chỉ server cloud vào bản build

Nếu muốn người chơi cài app xong dùng luôn, không cần tự nhập địa chỉ máy
chủ trong Cài Đặt, tạo file `.env` (copy từ `.env.example`) và điền:

```
VITE_SERVER_URL="ten-app-cua-ban.onrender.com"
```

Nếu bỏ qua bước này, app vẫn hoạt động bình thường — người chơi chỉ cần mở
**Cài Đặt ⚙️ → Máy Chủ Trung Gian (Cloud)** trong app, nhập địa chỉ, bấm
"Kiểm tra kết nối" rồi "Lưu & Kết nối lại".

### Bước 3: Tạo project Android (chỉ làm 1 lần)

```bash
npm run android:init
```

Lệnh này sẽ: build bản web tĩnh (`vite build`), tạo thư mục `android/`
(project Android Studio thật) và đồng bộ mã nguồn web vào đó.

### Bước 4: Mở project trong Android Studio

```bash
npm run android:open
```

Android Studio sẽ tự mở project `android/`. Đợi Gradle sync xong.

### Bước 5: Bổ sung quyền cần thiết cho Android (đã tự có INTERNET mặc định)

Mở `android/app/src/main/AndroidManifest.xml`, đảm bảo có các dòng sau bên
trong thẻ `<manifest>` (INTERNET đã có sẵn theo mặc định của Capacitor,
cần thêm RECORD_AUDIO cho tính năng thoại):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

Vì app gọi HTTPS/WSS tới máy chủ cloud (không dùng HTTP thường), bạn
**không cần** bật `usesCleartextTraffic`. Nếu bạn thử nghiệm với server nội
bộ (`http://192.168.x.x:3000`, chưa có SSL) trong quá trình phát triển, mới
cần thêm:

```xml
<application android:usesCleartextTraffic="true" ...>
```

(nhớ bỏ lại khi phát hành bản chính thức dùng server cloud có HTTPS).

### Bước 6: Build APK

Trong Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
File APK debug sẽ nằm ở:
`android/app/build/outputs/apk/debug/app-debug.apk`

Để build bản phát hành (ký số, tối ưu, chuẩn bị đăng Play Store), làm theo
hướng dẫn ký ứng dụng chính thức của Android Studo (**Build → Generate
Signed Bundle / APK**).

### Sau khi có APK

- Cài file `.apk` vào điện thoại Android (bật "Cài từ nguồn không xác định"
  nếu cài trực tiếp, không qua Play Store).
- Mở app → nếu chưa đóng đinh `VITE_SERVER_URL` lúc build, vào Cài Đặt ⚙️
  nhập địa chỉ máy chủ cloud đã triển khai ở Phần 1 → Lưu.
- Từ giờ, bất kỳ ai cài app này (dù đang ở mạng 4G, wifi nhà, wifi công ty
  nào) và trỏ cùng 1 địa chỉ máy chủ cloud, đều có thể tạo/vào chung 1
  phòng và chơi với nhau.

### Khi cần cập nhật code sau này

Mỗi khi sửa mã nguồn web (`src/`), chạy lại:

```bash
npm run android:sync
```

rồi build lại APK trong Android Studio.

---

## Tóm tắt kiến trúc mạng

```
[Điện thoại A - mạng 4G]  ──┐
[Điện thoại B - wifi nhà]  ─┼──► HTTPS/WSS ──► Máy chủ Cloud (Render...) ──► phân phối trạng thái phòng
[Máy tính C - wifi công ty] ┘         (WebSocket /ws + REST /api/room/*)
        │                                        │
        └────────── WebRTC (thoại) ◄── signaling qua chính máy chủ trên ──┘
```

Máy chủ cloud là "mạng trung gian" duy nhất mà mọi thiết bị, dù khác mạng
Internet, đều cùng kết nối tới — đó là lý do mọi người luôn thấy chung một
phòng chơi và (nếu STUN/TURN kết nối được) nghe được tiếng nhau.
