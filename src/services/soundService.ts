// ============================================================================
// WEREWOLF: NIGHT OF DECEPTION - Sound Service
// Sử dụng trực tiếp các file MP3 trong thư mục public/
// ============================================================================

import { loadAudioSettings, saveAudioSettings } from '../lib/audioSettings';

class SoundService {
  public isMuted: boolean = false;
  public bgmMuted: boolean = false;

  // Âm lượng hiệu ứng (0..1)
  public volume: number = 0.7;

  private audioCache: Map<string, HTMLAudioElement> = new Map();

  private bgm: HTMLAudioElement | null = null;

  constructor() {
    const saved = loadAudioSettings();

    this.isMuted = saved.sfxMuted;
    this.volume = saved.sfxVolume;
    this.bgmMuted = saved.bgmMuted;
  }

  // ==========================================================================
  // LƯU CÀI ĐẶT
  // ==========================================================================

  private persist() {
    const saved = loadAudioSettings();

    saveAudioSettings({
      ...saved,
      sfxMuted: this.isMuted,
      sfxVolume: this.volume,
      bgmMuted: this.bgmMuted,
    });
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));

    // Cập nhật volume cho các sound đã được tạo
    this.audioCache.forEach((audio) => {
      audio.volume = this.volume;
    });

    this.persist();
  }

  // ==========================================================================
  // AUDIO LOADER
  // ==========================================================================

  private getAudio(file: string): HTMLAudioElement {
    let audio = this.audioCache.get(file);

    if (!audio) {
      audio = new Audio(`/${file}`);

      audio.preload = 'auto';
      audio.volume = this.volume;
      audio.muted = this.isMuted;

      this.audioCache.set(file, audio);
    }

    return audio;
  }

  private play(file: string, volumeMultiplier = 1) {
    try {
      if (this.isMuted || this.volume <= 0) return;

      const audio = this.getAudio(file);

      audio.pause();
      audio.currentTime = 0;

      audio.volume = Math.max(
        0,
        Math.min(1, this.volume * volumeMultiplier)
      );

      audio.muted = this.isMuted;

      const promise = audio.play();

      if (promise) {
        promise.catch(() => {
          // Trình duyệt có thể chặn autoplay.
          // Lần tương tác tiếp theo sẽ cho phép phát.
        });
      }
    } catch {
      // Không làm crash game nếu audio lỗi.
    }
  }

  // ==========================================================================
  // CLICK
  // ==========================================================================

  public playClick() {
    this.play('click.mp3', 0.8);
  }

  // ==========================================================================
  // TIẾNG SÓI
  // ==========================================================================

  public playWolfHowl() {
    this.play('wolf-howl.mp3', 1);
  }

  // ==========================================================================
  // CHUÔNG BUỔI SÁNG
  // ==========================================================================

  public playMorningBell() {
    this.play('morning-bell.mp3', 1);
  }

  // ==========================================================================
  // BÚA BỎ PHIẾU
  // ==========================================================================

  public playGavelStrike() {
    this.play('gavel.mp3', 1);
  }

  // ==========================================================================
  // LẬT BÀI
  // ==========================================================================

  public playCardFlip() {
    this.play('card-flip.mp3', 1);
  }

  // ==========================================================================
  // CHIẾN THẮNG
  // ==========================================================================

  public playVictory() {
    this.play('victory.mp3', 1);
  }

  // ==========================================================================
  // NGƯỜI CHẾT
  // ==========================================================================

  public playDeathToll() {
    this.play('death.mp3', 1);
  }

  // ==========================================================================
  // CÁC SOUND VAI TRÒ / GIAI ĐOẠN
  // ==========================================================================

  public playNight() {
    this.play('night.mp3', 1);
  }

  public playCupid() {
    this.play('cupid.mp3', 1);
  }

  public playWitch() {
    this.play('witch.mp3', 1);
  }

  public playSeer() {
    this.play('seer.mp3', 1);
  }

  public playBodyguard() {
    this.play('bodyguard.mp3', 1);
  }

  public playWolfTurn() {
    this.play('wolf-turn.mp3', 1);
  }

  public playVote() {
    this.play('vote.mp3', 1);
  }

  public playTimeout() {
    this.play('timeout.mp3', 1);
  }

  // ==========================================================================
  // TƯƠNG THÍCH VỚI CODE CŨ
  // ==========================================================================
  // GameContext hiện tại có thể gọi hàm này dù file sound chưa có.
  // Nếu sau này bạn thêm silence-curse.mp3 thì sẽ tự phát file đó.

  public playSilenceCurseSound() {
    this.play('silence-curse.mp3', 1);
  }

  // ==========================================================================
  // NHẠC NỀN
  // ==========================================================================

  public startAmbientBgm() {
    try {
      if (this.bgmMuted || this.bgm) return;

      this.bgm = new Audio('/bgm.mp3');

      this.bgm.loop = true;
      this.bgm.preload = 'auto';
      this.bgm.volume = 0.25;
      this.bgm.muted = this.bgmMuted;

      const promise = this.bgm.play();

      if (promise) {
        promise.catch(() => {
          // Autoplay bị trình duyệt chặn.
        });
      }
    } catch {
      // Không làm crash game.
    }
  }

  public stopAmbientBgm() {
    if (!this.bgm) return;

    try {
      this.bgm.pause();
      this.bgm.currentTime = 0;
      this.bgm.src = '';
    } catch {
      // Ignore
    }

    this.bgm = null;
  }

  // ==========================================================================
  // TẮT / BẬT ÂM THANH HIỆU ỨNG
  // ==========================================================================

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;

    this.audioCache.forEach((audio) => {
      audio.muted = this.isMuted;
    });

    if (this.isMuted) {
      this.stopAmbientBgm();
    }

    this.persist();

    return this.isMuted;
  }
}

export const soundManager = new SoundService();