import React, { useState, useEffect } from 'react';
import { HostTransferRequest } from '../types';
import { Crown, Check, X, Clock } from 'lucide-react';

interface Props {
  request: HostTransferRequest | null;
  onRespond: (accept: boolean) => void;
}

export const HostTransferModal: React.FC<Props> = ({ request, onRespond }) => {
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  useEffect(() => {
    if (!request) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((request.expiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        onRespond(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [request, onRespond]);

  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-[#0B0F19] border border-amber-500/50 rounded-3xl shadow-2xl p-6 space-y-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto animate-bounce">
          <Crown className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white font-serif tracking-wide">
            YÊU CẦU NHẬN QUYỀN QUẢN TRÒ
          </h3>
          <p className="text-xs text-zinc-300">
            Quản trò <strong className="text-amber-400">{request.fromPlayerName}</strong> muốn chuyển giao quyền làm Chủ Phòng cho bạn!
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-mono">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Hết hạn sau: <strong className="text-amber-400">{secondsRemaining}s</strong></span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => onRespond(false)}
            className="py-2.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Từ Chối</span>
          </button>

          <button
            onClick={() => onRespond(true)}
            className="py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 transition flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Đồng Ý Nhận</span>
          </button>
        </div>
      </div>
    </div>
  );
};
