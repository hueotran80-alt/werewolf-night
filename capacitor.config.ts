import type { CapacitorConfig } from '@capacitor/cli';

// Cấu hình đóng gói ứng dụng web này thành APK Android bằng Capacitor.
// Ứng dụng vẫn hoạt động như một web app bên trong WebView của Android,
// nhưng mọi dữ liệu game (tạo phòng, vào phòng, hành động, chat, tín hiệu
// thoại...) đều gọi ra máy chủ trung gian cloud đã cấu hình trong
// src/lib/serverConfig.ts (qua màn hình Cài Đặt trong app, hoặc biến môi
// trường VITE_SERVER_URL lúc build) - KHÔNG đóng gói server bên trong APK.
const config: CapacitorConfig = {
  appId: 'app.werewolf.nightofdeception',
  appName: 'Ma Sói: Đêm Lừa Dối',
  // Trỏ tới bundle web tĩnh đã build (npm run build) - xem vite.config.ts (outDir: dist/client)
  webDir: 'dist/client',
  server: {
    // Cho phép WebView của Android điều hướng/gọi tới các domain cloud của bạn
    // (điền domain thật khi build bản phát hành, ví dụ 'ten-server.onrender.com').
    // Để trống mảng này thì mặc định Capacitor đã cho phép gọi API https bất kỳ
    // qua fetch/XHR/WebSocket - allowNavigation chỉ cần thiết nếu bạn muốn
    // WebView "chuyển trang" thẳng sang domain đó.
    allowNavigation: [],
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
