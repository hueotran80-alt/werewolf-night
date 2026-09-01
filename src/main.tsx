import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { soundManager } from './services/soundService';

// Global error handlers to prevent unhandled promise rejections and script error crashes
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Unhandled promise rejection caught:', event.reason);
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    console.warn('Global script error caught:', event.error || event.message);
  });

  // ============================================================
  // ÂM THANH KHI BẤM NÚT (toàn app)
  // ------------------------------------------------------------
  // Thay vì phải thêm onClick thủ công vào từng nút trong hàng chục màn
  // hình, ta bắt sự kiện click ở mức document (capture phase) và phát tiếng
  // "click" ngắn mỗi khi người dùng bấm vào một <button> (hoặc phần tử có
  // role="button") đang không bị disabled. Cách này đảm bảo MỌI nút trong
  // app đều có âm thanh phản hồi, kể cả các nút thêm mới sau này.
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const control = target.closest('button, [role="button"]') as HTMLElement | null;
      if (!control) return;
      if (control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') return;
      soundManager.playClick();
    },
    { capture: true }
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
