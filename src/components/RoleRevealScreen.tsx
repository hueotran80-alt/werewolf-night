import React, { useState, useEffect } from 'react';
import { RoleId, RoomData } from '../types';
import { ROLES_DATABASE } from '../data/rolesData';
import { RoleCardIllustration } from './RoleCardIllustration';
import { Sparkles, Eye, Shield, Check, Clock } from 'lucide-react';

interface Props {
  room: RoomData;
  roleId: RoleId;
  onUnderstood: () => void;
}

export const RoleRevealScreen: React.FC<Props> = ({ room, roleId, onUnderstood }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(8);

  const role = ROLES_DATABASE[roleId] || ROLES_DATABASE.VILLAGER;

  useEffect(() => {
    // Auto flip after 800ms
    const flipTimer = setTimeout(() => {
      setIsFlipped(true);
    }, 800);

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearTimeout(flipTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#060810] text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Gothic Ambient Lighting */}
      <div
        className="absolute w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ backgroundColor: role.colorScheme.primary }}
      />

      <div className="w-full max-w-md flex flex-col items-center text-center space-y-5 z-10 animate-fade-in">
        {/* Top Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ban đêm bắt đầu sau: <strong className="text-cyan-300">{secondsRemaining}s</strong></span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-black tracking-wider uppercase text-white mt-2">
            VAI TRÒ BÍ MẬT CỦA BẠN
          </h2>
          <p className="text-xs text-zinc-400">
            Hãy giữ kín danh tính và ghi nhớ mục tiêu của bản thân!
          </p>
        </div>

        {/* 3D Card Display */}
        <div className="relative group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
          <div
            className={`transition-all duration-700 transform ${
              isFlipped ? 'scale-100 rotate-0' : 'scale-95 rotate-3'
            }`}
          >
            <RoleCardIllustration roleId={roleId} size="hero" showDetails={false} />
          </div>
        </div>

        {/* Role Description Card */}
        <div className="w-full p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-left space-y-2.5 shadow-xl">
          <div>
            <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
              Nhiệm vụ & Kỹ năng:
            </div>
            <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
              {role.fullDescription}
            </p>
          </div>

          <div className="pt-2 border-t border-zinc-800/80">
            <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Điều kiện thắng:
            </div>
            <p className="text-xs text-amber-200/90 mt-0.5">
              {role.winCondition}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onUnderstood}
          className="w-full py-3.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-xl shadow-cyan-600/30 transition flex items-center justify-center gap-2 active:scale-95"
        >
          <Check className="w-4 h-4" />
          <span>TÔI ĐÃ HIỂU VAI TRÒ</span>
        </button>
      </div>
    </div>
  );
};
