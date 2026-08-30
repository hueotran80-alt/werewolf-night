// ============================================================================
// WEREWOLF: NIGHT OF DECEPTION - Cloud Server Configuration
// ----------------------------------------------------------------------------
// Cho phép app (web HOẶC Android build bằng Capacitor) kết nối tới MỘT máy chủ
// trung gian (cloud relay) duy nhất. Nhờ vậy, người chơi ở các mạng Internet
// khác nhau (nhà mạng khác nhau, 4G/5G, wifi khác nhau...) đều có thể vào
// chung một phòng, vì mọi dữ liệu đều đi qua máy chủ cloud này thay vì kết
// nối trực tiếp máy-tới-máy.
//
// Thứ tự ưu tiên khi xác định địa chỉ máy chủ:
//   1. Người dùng tự nhập trong màn hình Cài Đặt (lưu localStorage) -> áp dụng
//      ngay cả khi mở app dạng web lẫn khi đóng gói thành APK Android.
//   2. Biến môi trường build-time VITE_SERVER_URL (đặt trong file .env trước
//      khi chạy `npm run build`) -> dùng để "đóng đinh" sẵn server cho bản APK
//      phát hành, người chơi không cần tự nhập địa chỉ.
//   3. Nếu không có gì cả và đang chạy trên trình duyệt (bản web/dev) -> dùng
//      luôn địa chỉ (origin) đang load trang, giữ nguyên hành vi cũ khi tự host.
// ============================================================================

const STORAGE_KEY = 'werewolf_cloud_server';

// Các domain sau được coi là "máy tại chỗ" -> mặc định dùng http/ws thay vì
// https/wss (vì server local thường không có SSL).
const LOCAL_HOST_PATTERNS = [/^localhost$/i, /^127\.0\.0\.1$/, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[0-1])\./];

function isLocalHost(hostname: string): boolean {
  return LOCAL_HOST_PATTERNS.some((re) => re.test(hostname));
}

export interface ParsedServer {
  /** hostname[:port], không có protocol, ví dụ "my-werewolf.onrender.com" */
  hostAndPort: string;
  /** true nếu nên dùng https/wss (bảo mật) */
  secure: boolean;
}

// Chuẩn hoá chuỗi người dùng nhập: cho phép họ dán nguyên URL
// (https://abc.onrender.com), hoặc chỉ gõ domain trơn (abc.onrender.com),
// hoặc domain:port (192.168.1.5:3000).
export function parseServerInput(raw: string): ParsedServer | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;

  let secure: boolean | null = null;

  if (/^https:\/\//i.test(value)) {
    secure = true;
    value = value.replace(/^https:\/\//i, '');
  } else if (/^http:\/\//i.test(value)) {
    secure = false;
    value = value.replace(/^http:\/\//i, '');
  } else if (/^wss:\/\//i.test(value)) {
    secure = true;
    value = value.replace(/^wss:\/\//i, '');
  } else if (/^ws:\/\//i.test(value)) {
    secure = false;
    value = value.replace(/^ws:\/\//i, '');
  }

  // Bỏ path phía sau (vd người dùng lỡ dán kèm /ws hoặc dấu / cuối)
  value = value.replace(/\/.*$/, '');
  value = value.trim();
  if (!value) return null;

  const hostnameOnly = value.split(':')[0];
  if (secure === null) {
    secure = !isLocalHost(hostnameOnly);
  }

  return { hostAndPort: value, secure };
}

export function getSavedServerRaw(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(STORAGE_KEY) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

export function saveServer(raw: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (raw.trim()) {
        window.localStorage.setItem(STORAGE_KEY, raw.trim());
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    // ignore
  }
}

function getBuildTimeDefault(): string {
  try {
    // @ts-ignore - Vite injects import.meta.env at build time
    return (import.meta as any)?.env?.VITE_SERVER_URL || '';
  } catch {
    return '';
  }
}

/** Trả về địa chỉ máy chủ hiện tại đang được cấu hình (chuỗi thô, có thể rỗng). */
export function getConfiguredServerRaw(): string {
  const saved = getSavedServerRaw();
  if (saved) return saved;
  const buildDefault = getBuildTimeDefault();
  if (buildDefault) return buildDefault;
  return '';
}

/** true nếu app đang dùng địa chỉ do người dùng/nhà phát triển chỉ định (không phải window.location). */
export function hasExplicitServer(): boolean {
  return !!getConfiguredServerRaw();
}

function resolveParsed(): ParsedServer {
  const configured = getConfiguredServerRaw();
  const parsed = configured ? parseServerInput(configured) : null;
  if (parsed) return parsed;

  // Fallback: dùng chính origin của trang (chỉ hợp lý khi chạy web tự host,
  // hoặc môi trường dev). Trên app Android đóng gói (capacitor://localhost)
  // giá trị này sẽ KHÔNG hoạt động -> bắt buộc phải cấu hình server ở trên.
  if (typeof window !== 'undefined' && window.location?.host) {
    return {
      hostAndPort: window.location.host,
      secure: window.location.protocol === 'https:',
    };
  }
  return { hostAndPort: 'localhost:3000', secure: false };
}

export function getApiBaseUrl(): string {
  const { hostAndPort, secure } = resolveParsed();
  return `${secure ? 'https' : 'http'}://${hostAndPort}`;
}

export function getWsUrl(): string {
  const { hostAndPort, secure } = resolveParsed();
  return `${secure ? 'wss' : 'ws'}://${hostAndPort}/ws`;
}

export async function testServerConnection(raw: string): Promise<{ ok: boolean; message: string }> {
  const parsed = parseServerInput(raw);
  if (!parsed) {
    return { ok: false, message: 'Địa chỉ máy chủ không hợp lệ.' };
  }
  const url = `${parsed.secure ? 'https' : 'http'}://${parsed.hostAndPort}/api/health`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return { ok: false, message: `Máy chủ phản hồi lỗi (HTTP ${res.status}).` };
    }
    const data = await res.json();
    return { ok: true, message: `Kết nối thành công! Đang có ${data.activeRooms ?? 0} phòng hoạt động.` };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, message: 'Hết thời gian chờ. Kiểm tra lại địa chỉ hoặc mạng Internet.' };
    }
    return { ok: false, message: 'Không thể kết nối tới máy chủ. Kiểm tra lại địa chỉ / HTTPS / CORS.' };
  }
}
