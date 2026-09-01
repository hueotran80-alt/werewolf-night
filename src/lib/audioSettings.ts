// ============================================================================
// Kho cấu hình Âm thanh & Máy chủ TURN - lưu vào localStorage để giữ nguyên
// giữa các lần mở app. Đây là "nguồn sự thật" (single source of truth) duy
// nhất mà cả soundService (SFX tổng hợp) lẫn audioService (nhạc nền/tiếng sói
// hú mp3) và voiceService (WebRTC) đều đọc/ghi vào, để SettingsModal chỉ cần
// gọi các hàm ở đây mà không phải biết chi tiết từng service.
// ============================================================================

import { safeStorage } from './storage';

export interface AudioSettings {
  bgmMuted: boolean;
  bgmVolume: number; // 0..1
  sfxMuted: boolean;
  sfxVolume: number; // 0..1
}

export interface TurnConfig {
  urls: string; // vd: turn:openrelay.metered.ca:80
  username?: string;
  credential?: string;
}

const AUDIO_KEY = 'werewolf_audio_settings';
const TURN_KEY = 'werewolf_turn_config';

const DEFAULT_SETTINGS: AudioSettings = {
  bgmMuted: false,
  bgmVolume: 0.25,
  sfxMuted: false,
  sfxVolume: 0.7,
};

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = safeStorage.getItem(AUDIO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore malformed data, dùng mặc định
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveAudioSettings(settings: AudioSettings) {
  safeStorage.setItem(AUDIO_KEY, JSON.stringify(settings));
}

export function loadTurnConfig(): TurnConfig | null {
  try {
    const raw = safeStorage.getItem(TURN_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

export function saveTurnConfig(config: TurnConfig | null) {
  if (config && config.urls?.trim()) {
    safeStorage.setItem(TURN_KEY, JSON.stringify(config));
  } else {
    safeStorage.setItem(TURN_KEY, '');
  }
}
