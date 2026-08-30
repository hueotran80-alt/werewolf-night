import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handlers to prevent unhandled promise rejections and script error crashes
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Unhandled promise rejection caught:', event.reason);
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    console.warn('Global script error caught:', event.error || event.message);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
