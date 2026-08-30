import React, { useState } from 'react';
import { soundManager } from '../services/soundService';
import { useGame } from '../context/GameContext';
import { testServerConnection } from '../lib/serverConfig';
import { X, Volume2, VolumeX, Sparkles, Smartphone, Moon, Sun, Sliders, Cloud, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [fastAnimation, setFastAnimation] = useState(false);

  const { cloudServerAddress, setCloudServerAddress } = useGame();
  const [serverInput, setServerInput] = useState(cloudServerAddress);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState('');

  if (!isOpen) return null;

  const toggleMute = () => {
    const newState = soundManager.toggleMute();
    setIsMuted(newState);
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-[#0B0F19] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
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
        <div className="p-5 space-y-4">
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

          {/* Sound Synthesizer */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center gap-3">
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-rose-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-emerald-400" />
              )}
              <div>
                <div className="text-xs font-bold text-white">Âm Thanh Hiệu Ứng (SFX & Howl)</div>
                <div className="text-[10px] text-zinc-400">Tiếng hú sói, chuông sáng, búa bỏ phiếu</div>
              </div>
            </div>
            <button
              onClick={toggleMute}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                !isMuted
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {!isMuted ? 'BẬT' : 'TẮT'}
            </button>
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
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex justify-end">
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
