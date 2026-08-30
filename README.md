<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/4c75fc91-b469-42cd-8268-0ccce65a54b4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Triển khai Cloud & Đóng gói Android

Xem file **[HUONG_DAN_TRIEN_KHAI_ANDROID.md](./HUONG_DAN_TRIEN_KHAI_ANDROID.md)**
để biết cách:

1. Đưa máy chủ (`server.ts`) lên một dịch vụ cloud (Render/Railway/Fly.io...)
   làm "mạng trung gian" cho mọi người chơi khác mạng cùng kết nối.
2. Đóng gói giao diện web hiện có thành APK Android thật bằng Capacitor,
   trỏ về máy chủ cloud đó (cấu hình trong `src/lib/serverConfig.ts`, hoặc
   nhập trực tiếp trong màn hình Cài Đặt ⚙️ của app).
