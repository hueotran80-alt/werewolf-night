class AudioService {
  private bgm: HTMLAudioElement | null = null;
  private wolfHowl: HTMLAudioElement | null = null;

  private bgmVolume = 0.25;
  private sfxVolume = 0.7;

  private initialized = false;

  init() {
    if (this.initialized) return;

    this.bgm = new Audio('/bgm.mp3');
    this.bgm.loop = true;
    this.bgm.volume = this.bgmVolume;
    this.bgm.preload = 'auto';

    this.wolfHowl = new Audio('/wolf-howl.mp3');
    this.wolfHowl.volume = this.sfxVolume;
    this.wolfHowl.preload = 'auto';

    this.initialized = true;
  }

  async playBackgroundMusic() {
    this.init();

    if (!this.bgm) return;

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

    if (!this.wolfHowl) return;

    try {
      this.wolfHowl.currentTime = 0;
      await this.wolfHowl.play();
    } catch (error) {
      console.warn('[AUDIO] Không thể phát tiếng sói:', error);
    }
  }

  setBgmVolume(volume: number) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));

    if (this.bgm) {
      this.bgm.volume = this.bgmVolume;
    }
  }

  setSfxVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));

    if (this.wolfHowl) {
      this.wolfHowl.volume = this.sfxVolume;
    }
  }

  muteBgm() {
    if (this.bgm) {
      this.bgm.muted = true;
    }
  }

  unmuteBgm() {
    if (this.bgm) {
      this.bgm.muted = false;
    }
  }
}

export const audioService = new AudioService();