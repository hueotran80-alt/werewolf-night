import React from 'react';
import { RoleId } from '../types';
import { ROLES_DATABASE } from '../data/rolesData';
import { RoleCardIllustration } from './RoleCardIllustration';
import { X, Shield, Eye, Moon, Target, Award } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roleId: RoleId | null;
  isAlive: boolean;
  deathReason?: string;
}

export const MyCardModal: React.FC<Props> = ({
  isOpen,
  onClose,
  roleId,
  isAlive,
  deathReason,
}) => {
  if (!isOpen || !roleId) return null;

  const role = ROLES_DATABASE[roleId] || ROLES_DATABASE.VILLAGER;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#0B0F19] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white font-serif tracking-wider">
              🃏 THẺ BÀI CỦA BẠN
            </span>
            {!isAlive && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-700/50">
                💀 ĐÃ TỬ VONG
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Centered Large Card */}
          <div className="flex justify-center">
            <RoleCardIllustration roleId={roleId} size="lg" showDetails={false} />
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-cyan-400" />
                <span>Kỹ năng & Hành động:</span>
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed">{role.fullDescription}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Điều kiện chiến thắng:</span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">{role.winCondition}</p>
            </div>

            {!isAlive && deathReason && (
              <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300">
                <span className="font-semibold">Nguyên nhân tử vong:</span> {deathReason}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition"
          >
            Đóng Lá Bài
          </button>
        </div>
      </div>
    </div>
  );
};
