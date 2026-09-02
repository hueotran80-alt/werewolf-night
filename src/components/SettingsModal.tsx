import React, { useState } from 'react';
import { soundManager } from '../services/soundService';
import { audioService } from '../services/audioService';
import {
  X,
  Volume2,
  VolumeX,
  Music,
  Sparkles,
  Smartphone,
  Sliders,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [sfxMuted, setSfxMuted] = useState(soundManager.isMuted);
  const [sfxVolume, setSfxVolume] = useState(Math.round(soundManager.volume * 100));
  const [bgmMuted, setBgmMuted] = useState(audioService.isBgmMuted());
  const [bgmVolume, setBgmVolume] = useState(Math.round(audioService.getBgmVolume() * 100));

  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [fastAnimation, setFastAnimation] = useState(false);



  if (!isOpen) return null;

  // ============================================================
  // ÂM THANH HIỆU ỨNG (SFX & tiếng sói hú)
  // ============================================================
  const toggleSfxMuted = () => {
    const newState = soundManager.toggleMute();
    audioService.setSfxMuted(newState);
    setSfxMuted(newState);
    if (!newState) soundManager.playClick();
  };

  const handleSfxVolumeChange = (value: number) => {
    setSfxVolume(value);
    soundManager.setVolume(value / 100);
    audioService.setSfxVolume(value / 100);
  };

  // ============================================================
  // NHẠC NỀN (BGM)
  // ============================================================
  const toggleBgmMuted = () => {
    const newState = !bgmMuted;
    audioService.setBgmMuted(newState);
    setBgmMuted(newState);
  };

  const handleBgmVolumeChange = (value: number) => {
    setBgmVolume(value);
    audioService.setBgmVolume(value / 100);
  };




  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-[#0B0F19] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-zinc-800 text-zinc-300">
              <Sliders className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-white font-serif tracking-wide">
              CÀI ĐẶT TRÒ CHƠI
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Nhạc Nền (BGM) */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Music className={`w-5 h-5 ${bgmMuted ? 'text-rose-400' : 'text-cyan-400'}`} />
                <div>
                  <div className="text-xs font-bold text-white">Nhạc Nền</div>
                  <div className="text-[10px] text-zinc-400">Nhạc nền phát ở màn hình chính</div>
                </div>
              </div>
              <button
                onClick={toggleBgmMuted}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  !bgmMuted
                    ? 'bg-cyan-950 text-cyan-400 border border-cyan-700/50'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {!bgmMuted ? 'BẬT' : 'TẮT'}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={bgmVolume}
              disabled={bgmMuted}
              onChange={(e) => handleBgmVolumeChange(Number(e.target.value))}
              className="w-full accent-cyan-500 disabled:opacity-40"
            />
          </div>

          {/* Âm Thanh Hiệu Ứng (SFX + tiếng sói hú) */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {sfxMuted ? (
                  <VolumeX className="w-5 h-5 text-rose-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-emerald-400" />
                )}
                <div>
                  <div className="text-xs font-bold text-white">Âm Thanh Hiệu Ứng</div>
                  <div className="text-[10px] text-zinc-400">
                    Tiếng sói hú, chuông sáng, búa bỏ phiếu, tiếng bấm nút
                  </div>
                </div>
              </div>
              <button
                onClick={toggleSfxMuted}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  !sfxMuted
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {!sfxMuted ? 'BẬT' : 'TẮT'}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={sfxVolume}
              disabled={sfxMuted}
              onChange={(e) => handleSfxVolumeChange(Number(e.target.value))}
              className="w-full accent-emerald-500 disabled:opacity-40"
            />
          </div>

          {/* Haptic Vibration */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-xs font-bold text-white">Rung Phản Hồi (Haptics)</div>
                <div className="text-[10px] text-zinc-400">Rung khi đến lượt hành động hoặc bị tấn công</div>
              </div>
            </div>
            <button
              onClick={() => setVibrationEnabled(!vibrationEnabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                vibrationEnabled
                  ? 'bg-blue-950 text-blue-400 border border-blue-700/50'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {vibrationEnabled ? 'BẬT' : 'TẮT'}
            </button>
          </div>

          {/* Fast Animations */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <div>
                <div className="text-xs font-bold text-white">Chuyển Cảnh Tốc Độ Cao</div>
                <div className="text-[10px] text-zinc-400">Giảm thời gian hiệu ứng lật bài</div>
              </div>
            </div>
            <button
              onClick={() => setFastAnimation(!fastAnimation)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                fastAnimation
                  ? 'bg-purple-950 text-purple-400 border border-purple-700/50'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {fastAnimation ? 'BẬT' : 'TẮT'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
