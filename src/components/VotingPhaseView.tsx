import React, { useState } from 'react';
import { Player, RoomData, RoleId } from '../types';
import { Gavel, Check, Clock, AlertTriangle, ShieldCheck, Crown } from 'lucide-react';

interface Props {
  room: RoomData;
  myPlayer: Player;
  myRole: RoleId | null;
  onSubmitVote: (targetPlayerId: string) => void;
  onOpenMyCard: () => void;
}

export const VotingPhaseView: React.FC<Props> = ({
  room,
  myPlayer,
  myRole,
  onSubmitVote,
  onOpenMyCard,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const gameState = room.gameState;
  const votingState = gameState?.votingState;
  const isResolution = gameState?.currentPhase === 'VOTE_RESOLUTION';
  const isAlive = myPlayer.isAlive;
  const isMayor = myRole === 'MAYOR';

  const remainingSeconds = gameState?.phaseEndsAt
    ? Math.max(0, Math.round((gameState.phaseEndsAt - Date.now()) / 1000))
    : 30;

  const handleVoteSubmit = () => {
    if (!selectedTargetId || !isAlive || hasVoted) return;
    onSubmitVote(selectedTargetId);
    setHasVoted(true);
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between max-w-4xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 rounded-3xl bg-rose-950/20 border border-rose-800/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <Gavel className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-white font-serif tracking-wide flex items-center gap-2">
              <span>{isResolution ? '🪢 KẾT QUẢ XÉT XỬ' : `⚖️ BỎ PHIẾU TREO CỔ - VÒNG ${gameState?.roundNumber || 1}`}</span>
              {isMayor && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  👑 Phiếu x2 (Cảnh Sát Trưởng)
                </span>
              )}
            </h3>
            <p className="text-xs text-rose-200/80">
              {isResolution
                ? 'Hội đồng Làng đã quyết định số phận kẻ bị tình nghi...'
                : 'Hãy bầu 1 người bạn tin là Ma Sói để đưa lên giàn treo cổ.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isResolution && (
            <div className="px-3.5 py-1.5 rounded-2xl bg-zinc-900 border border-zinc-800 font-mono text-xs font-bold text-rose-400">
              ⏳ {remainingSeconds}s
            </div>
          )}
          <button
            onClick={onOpenMyCard}
            className="px-3.5 py-1.5 rounded-2xl bg-purple-950/60 hover:bg-purple-900 border border-purple-700/50 text-xs font-bold text-purple-300 transition"
          >
            🃏 Lá Bài
          </button>
        </div>
      </div>

      {/* Resolution Box if phase is VOTE_RESOLUTION */}
      {isResolution && (
        <div className="p-5 rounded-3xl bg-zinc-950/90 border border-rose-800/60 shadow-2xl space-y-3 text-center">
          {gameState?.lastDayEliminated ? (
            <div className="space-y-1">
              <div className="text-2xl">🪢</div>
              <h4 className="text-base font-bold text-rose-300 font-serif">
                {gameState.lastDayEliminated.playerName} đã bị xử tử trên giàn treo cổ!
              </h4>
              <p className="text-xs text-zinc-400">
                Nhận được {gameState.lastDayEliminated.votesReceived} phiếu bầu từ Dân Làng.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-2xl">⚖️</div>
              <h4 className="text-base font-bold text-amber-300 font-serif">
                Không ai bị treo cổ trong phiên tòa hôm nay!
              </h4>
              <p className="text-xs text-zinc-400">
                Số phiếu biểu quyết bị hòa hoặc không có ai nhận đủ đa số phiếu.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Voting Target Candidates */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {room.players.map((p) => {
          const isSelected = selectedTargetId === p.id;
          const isMe = p.id === myPlayer.id;
          const isDead = !p.isAlive;
          const currentVoteCount = votingState?.voteCounts?.[p.id] || 0;

          return (
            <button
              key={p.id}
              disabled={isDead || isMe || hasVoted || isResolution || !isAlive}
              onClick={() => setSelectedTargetId(p.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-32 ${
                isDead
                  ? 'bg-zinc-950/40 border-zinc-900 opacity-40 cursor-not-allowed'
                  : isSelected
                  ? 'bg-zinc-800/90 border-rose-500 ring-2 ring-rose-500/40 shadow-xl'
                  : isMe
                  ? 'bg-zinc-900/50 border-zinc-800 cursor-default'
                  : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-zinc-800 to-zinc-700 flex items-center justify-center font-bold text-xs text-white border border-zinc-600">
                  {p.nickname.charAt(0).toUpperCase()}
                </div>

                {/* Vote Counter Pill */}
                {currentVoteCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-700 animate-pulse">
                    {currentVoteCount} 🗳️
                  </span>
                )}
              </div>

              <div>
                <div className="font-bold text-xs text-white truncate flex items-center gap-1">
                  <span>{p.nickname}</span>
                  {p.role === 'MAYOR' && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {isDead ? '💀 Đã chết' : isMe ? '👤 Là bạn' : '🎯 Ứng viên'}
                </div>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 p-1 rounded-full bg-rose-500 text-white">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Confirm Action */}
      {!isResolution && (
        <div className="p-4 rounded-3xl bg-zinc-950/80 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-300">
            {isAlive ? (
              hasVoted ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Bạn đã bỏ phiếu thành công! Đang chờ làng chốt kết quả...
                </span>
              ) : (
                <span>
                  Chọn 1 ứng viên bên trên rồi bấm <strong>XÁC NHẬN BỎ PHIẾU</strong>.
                </span>
              )
            ) : (
              <span className="text-zinc-500">
                👻 Bạn đã chết và không có quyền tham gia bỏ phiếu.
              </span>
            )}
          </div>

          {isAlive && !hasVoted && (
            <button
              disabled={!selectedTargetId}
              onClick={handleVoteSubmit}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Gavel className="w-4 h-4" />
              <span>XÁC NHẬN BỎ PHIẾU</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
