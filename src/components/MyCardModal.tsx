import React from 'react';
import { RoleId } from '../types';
import { ROLES_DATABASE } from '../data/rolesData';
import { RoleCardIllustration } from './RoleCardIllustration';
import { X, Moon, Award } from 'lucide-react';

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

  const role =
    ROLES_DATABASE[roleId] ||
    ROLES_DATABASE.VILLAGER;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md max-h-[92vh] bg-[#0B0F19] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">

        {/* HEADER */}
        <div className="p-3 sm:p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-white font-serif tracking-wider truncate">
              🃏 THẺ BÀI CỦA BẠN
            </span>

            {!isAlive && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-700/50">
                💀 ĐÃ TỬ VONG
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 ml-2 w-9 h-9 flex items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="px-4 py-4 sm:px-5 sm:py-5 overflow-y-auto space-y-4">

          {/* CARD */}
          <div className="flex justify-center">
            <div className="w-[150px] sm:w-[170px] md:w-[185px]">
              <RoleCardIllustration
                roleId={roleId}
                size="md"
                showDetails={false}
                className="w-full"
              />
            </div>
          </div>

          {/* DETAILS */}
          <div className="space-y-3">

            {/* Ability */}
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-cyan-400" />

                <span>
                  Kỹ năng & Hành động:
                </span>
              </div>

              <p className="text-xs text-zinc-200 leading-relaxed">
                {role.fullDescription}
              </p>
            </div>

            {/* Win condition */}
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />

                <span>
                  Điều kiện chiến thắng:
                </span>
              </div>

              <p className="text-xs text-amber-200/90 leading-relaxed">
                {role.winCondition}
              </p>
            </div>

            {/* Death reason */}
            {!isAlive && deathReason && (
              <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300">
                <span className="font-semibold">
                  Nguyên nhân tử vong:
                </span>{' '}
                {deathReason}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-950/80 shrink-0">
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