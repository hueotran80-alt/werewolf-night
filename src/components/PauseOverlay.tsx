import React from 'react';
import { GameState } from '../types';
import { Pause, Play, RotateCcw } from 'lucide-react';

interface Props {
  gameState: GameState;
  isHost: boolean;
  onResume: () => void;
  onReset: () => void;
}

export const PauseOverlay: React.FC<Props> = ({ gameState, isHost, onResume, onReset }) => {
  if (!gameState.isPaused) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl bg-zinc-950/95 border border-amber-800/60 shadow-2xl p-6 space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-700/50 flex items-center justify-center text-amber-300">
            <Pause className="w-8 h-8" />
          </div>
          <h2 className="mt-4 text-xl font-serif font-black text-white">TRẬN ĐẤU ĐANG TẠM DỪNG</h2>
          <p className="mt-2 text-sm text-amber-200">
            {gameState.pausedByPlayerName || 'Một người chơi'} đã tạm dừng trận đấu.
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4 text-xs text-zinc-300 space-y-2">
          <div className="font-bold text-zinc-100">Thông tin kiểm tra</div>
          <p className="text-zinc-400">Trận đã dừng thời gian và không tiếp nhận tiến trình mới.</p>
          <p className="text-zinc-500">Tên nhân vật/vai trò bí mật vẫn được bảo vệ trên giao diện công khai.</p>
        </div>

        <div className="flex gap-2">
          <button onClick={onResume} className="flex-1 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2">
            <Play className="w-4 h-4" /> Tiếp tục
          </button>
          {isHost && (
            <button onClick={onReset} className="px-4 py-3 rounded-2xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-sm flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> Reset trận
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
