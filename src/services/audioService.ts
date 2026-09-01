import { loadAudioSettings, saveAudioSettings } from '../lib/audioSettings';

class AudioService {
  private bgm: HTMLAudioElement | null = null;
  private wolfHowl: HTMLAudioElement | null = null;

  private bgmVolume = 0.25;
  private sfxVolume = 0.7;
  private bgmMuted = false;
  private sfxMuted = false;

  private initialized = false;

  constructor() {
    // Khôi phục cấu hình đã lưu (âm lượng + trạng thái tắt/bật) ngay từ đầu,
    // để màn hình Cài Đặt hiển thị đúng giá trị dù chưa phát âm thanh nào
    // (việc tạo thẻ <audio> thật thì vẫn đợi đến init(), tương tác đầu tiên).
    const saved = loadAudioSettings();
    this.bgmVolume = saved.bgmVolume;
    this.sfxVolume = saved.sfxVolume;
    this.bgmMuted = saved.bgmMuted;
    this.sfxMuted = saved.sfxMuted;
  }

  init() {
    if (this.initialized) return;

    this.bgm = new Audio('/bgm.mp3');
    this.bgm.loop = true;
    this.bgm.volume = this.bgmVolume;
    this.bgm.muted = this.bgmMuted;
    this.bgm.preload = 'auto';

    this.wolfHowl = new Audio('/wolf-howl.mp3');
    this.wolfHowl.volume = this.sfxVolume;
    this.wolfHowl.muted = this.sfxMuted;
    this.wolfHowl.preload = 'auto';

    this.initialized = true;
  }

  private persist() {
    const saved = loadAudioSettings();
    saveAudioSettings({
      ...saved,
      bgmVolume: this.bgmVolume,
      sfxVolume: this.sfxVolume,
      bgmMuted: this.bgmMuted,
      sfxMuted: this.sfxMuted,
    });
  }

  async playBackgroundMusic() {
    this.init();

    if (!this.bgm || this.bgmMuted) return;

    try {
      await this.bgm.play();
    } catch (error) {
      console.warn('[AUDIO] Trình duyệt chặn autoplay:', error);
    }
  }

  stopBackgroundMusic() {
    if (!this.bgm) return;

    this.bgm.pause();
    this.bgm.currentTime = 0;
  }

  async playWolfHowl() {
    this.init();

    if (!this.wolfHowl || this.sfxMuted) return;

    try {
      this.wolfHowl.currentTime = 0;
      await this.wolfHowl.play();
    } catch (error) {
      console.warn('[AUDIO] Không thể phát tiếng sói:', error);
    }
  }

  setBgmVolume(volume: number) {
    this.init();
    this.bgmVolume = Math.max(0, Math.min(1, volume));

    if (this.bgm) {
      this.bgm.volume = this.bgmVolume;
    }
    this.persist();
  }

  setSfxVolume(volume: number) {
    this.init();
    this.sfxVolume = Math.max(0, Math.min(1, volume));

    if (this.wolfHowl) {
      this.wolfHowl.volume = this.sfxVolume;
    }
    this.persist();
  }

  getBgmVolume() {
    return this.bgmVolume;
  }

  getSfxVolume() {
    return this.sfxVolume;
  }

  isBgmMuted() {
    return this.bgmMuted;
  }

  isSfxMuted() {
    return this.sfxMuted;
  }

  setBgmMuted(muted: boolean) {
    this.init();
    this.bgmMuted = muted;
    if (this.bgm) {
      this.bgm.muted = muted;
      if (muted) {
        this.bgm.pause();
      } else {
        this.bgm.play().catch(() => {});
      }
    }
    this.persist();
  }

  setSfxMuted(muted: boolean) {
    this.init();
    this.sfxMuted = muted;
    if (this.wolfHowl) {
      this.wolfHowl.muted = muted;
    }
    this.persist();
  }

  // Giữ lại 2 hàm cũ để tương thích ngược với những chỗ gọi trực tiếp muteBgm/unmuteBgm
  muteBgm() {
    this.setBgmMuted(true);
  }

  unmuteBgm() {
    this.setBgmMuted(false);
  }
}

export const audioService = new AudioService();
