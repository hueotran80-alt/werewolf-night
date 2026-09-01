import React, { useState } from 'react';
import { soundManager } from '../services/soundService';
import { audioService } from '../services/audioService';
import { useGame } from '../context/GameContext';
import { testServerConnection } from '../lib/serverConfig';
import { loadTurnConfig, saveTurnConfig } from '../lib/audioSettings';
import {
  X,
  Volume2,
  VolumeX,
  Music,
  Sparkles,
  Smartphone,
  Sliders,
  Cloud,
  Loader2,
  CheckCircle2,
  XCircle,
  Radio,
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

  const { cloudServerAddress, setCloudServerAddress } = useGame();
  const [serverInput, setServerInput] = useState(cloudServerAddress);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const savedTurn = loadTurnConfig();
  const [turnUrl, setTurnUrl] = useState(savedTurn?.urls || '');
  const [turnUser, setTurnUser] = useState(savedTurn?.username || '');
  const [turnCred, setTurnCred] = useState(savedTurn?.credential || '');
  const [turnSaved, setTurnSaved] = useState(false);

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

  // ============================================================
  // MÁY CHỦ TRUNG GIAN (Cloud relay - tín hiệu phòng/game)
  // ============================================================
  const handleTestServer = async () => {
    if (!serverInput.trim()) return;
    setTestState('testing');
    const result = await testServerConnection(serverInput);
    setTestState(result.ok ? 'ok' : 'fail');
    setTestMessage(result.message);
  };

  const handleSaveServer = () => {
    setCloudServerAddress(serverInput);
    setTestState('idle');
    setTestMessage('Đã lưu! App sẽ kết nối lại tới máy chủ mới.');
  };

  // ============================================================
  // MÁY CHỦ TURN (bắt buộc để 2 máy NGHE ĐƯỢC nhau qua mạng 4G/Wifi khác nhau)
  // ============================================================
  const handleSaveTurn = () => {
    if (turnUrl.trim()) {
      saveTurnConfig({ urls: turnUrl.trim(), username: turnUser.trim(), credential: turnCred.trim() });
    } else {
      saveTurnConfig(null);
    }
    setTurnSaved(true);
    setTimeout(() => setTurnSaved(false), 2500);
  };

  const handleClearTurn = () => {
    setTurnUrl('');
    setTurnUser('');
    setTurnCred('');
    saveTurnConfig(null);
    setTurnSaved(true);
    setTimeout(() => setTurnSaved(false), 2500);
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
          {/* Cloud Relay Server */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
            <div className="flex items-center gap-3">
              <Cloud className="w-5 h-5 text-sky-400" />
              <div>
                <div className="text-xs font-bold text-white">Máy Chủ Trung Gian (Cloud)</div>
                <div className="text-[10px] text-zinc-400">
                  Nhập địa chỉ máy chủ đã triển khai trên cloud để chơi cùng người khác mạng
                </div>
              </div>
            </div>
            <input
              type="text"
              value={serverInput}
              onChange={(e) => {
                setServerInput(e.target.value);
                setTestState('idle');
              }}
              placeholder="vd: ten-server-cua-ban.onrender.com"
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
              autoCapitalize="none"
              autoCorrect="off"
            />
            {testMessage && (
              <div
                className={`flex items-center gap-1.5 text-[10px] ${
                  testState === 'ok' ? 'text-emerald-400' : testState === 'fail' ? 'text-rose-400' : 'text-zinc-400'
                }`}
              >
                {testState === 'ok' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {testState === 'fail' && <XCircle className="w-3.5 h-3.5" />}
                <span>{testMessage}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleTestServer}
                disabled={testState === 'testing' || !serverInput.trim()}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {testState === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Kiểm tra kết nối
              </button>
              <button
                onClick={handleSaveServer}
                disabled={!serverInput.trim()}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-700/50 transition disabled:opacity-50"
              >
                Lưu & Kết nối lại
              </button>
            </div>
          </div>

          {/* Máy chủ TURN - để 2 máy thực sự NGHE ĐƯỢC nhau */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-xs font-bold text-white">Máy Chủ TURN (Voice Chat)</div>
                <div className="text-[10px] text-zinc-400">
                  Giúp giọng nói kết nối được khi 2 máy dùng mạng 4G/Wifi khác nhau.
                </div>
              </div>
            </div>
            <input
              type="text"
              value={turnUrl}
              onChange={(e) => setTurnUrl(e.target.value)}
              placeholder="vd: turn:my-turn-server.com:3478"
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={turnUser}
                onChange={(e) => setTurnUser(e.target.value)}
                placeholder="Username"
                className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <input
                type="password"
                value={turnCred}
                onChange={(e) => setTurnCred(e.target.value)}
                placeholder="Credential"
                className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            {turnSaved && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đã lưu! Vào lại phòng để áp dụng TURN mới.</span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleClearTurn}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition"
              >
                Dùng mặc định
              </button>
              <button
                onClick={handleSaveTurn}
                disabled={!turnUrl.trim()}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-700/50 transition disabled:opacity-50"
              >
                Lưu TURN
              </button>
            </div>
          </div>

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
