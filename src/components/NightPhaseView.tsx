import React, { useState } from 'react';
import { Player, RoomData, RoleId, GameAction } from '../types';
import { ROLES_DATABASE } from '../data/rolesData';
import { Moon, Shield, Eye, Skull, Crosshair, Check, Sparkles, MicOff, Heart, VolumeX } from 'lucide-react';

interface Props {
  room: RoomData;
  myPlayer: Player;
  myRole: RoleId | null;
  onSubmitAction: (action: GameAction) => void;
  onOpenMyCard: () => void;
}

export const NightPhaseView: React.FC<Props> = ({
  room,
  myPlayer,
  myRole,
  onSubmitAction,
  onOpenMyCard,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [witchAction, setWitchAction] = useState<'NONE' | 'HEAL' | 'POISON'>('NONE');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const gameState = room.gameState;
  const nightState = gameState?.nightState;
  const isHunterRevenge = gameState?.currentPhase === 'HUNTER_REVENGE';
  const roleDef = myRole ? ROLES_DATABASE[myRole] : null;

  const livingPlayers = room.players.filter((p) => p.isAlive);
  const isWerewolf = roleDef?.team === 'WEREWOLF';

  // Calculate remaining seconds
  const remainingSeconds = gameState?.phaseEndsAt
    ? Math.max(0, Math.round((gameState.phaseEndsAt - Date.now()) / 1000))
    : 30;

  const handleSelectPlayer = (targetPlayer: Player) => {
    if (!myPlayer.isAlive && !isHunterRevenge) return;
    if (targetPlayer.id === myPlayer.id && myRole !== 'BODYGUARD') return; // Only bodyguard might self-guard depending on settings
    setSelectedTargetId(targetPlayer.id);
  };

  const handleConfirmAction = () => {
    if (!myRole) return;

    if (isHunterRevenge && selectedTargetId) {
      onSubmitAction({
        actionType: 'HUNTER_KILL',
        actorPlayerId: myPlayer.id,
        targetPlayerId: selectedTargetId,
      });
      setHasSubmitted(true);
      return;
    }

    if (isWerewolf && selectedTargetId) {
      onSubmitAction({
        actionType: 'WOLF_KILL',
        actorPlayerId: myPlayer.id,
        targetPlayerId: selectedTargetId,
      });
      setHasSubmitted(true);
    } else if (myRole === 'SEER' && selectedTargetId) {
      onSubmitAction({
        actionType: 'SEER_CHECK',
        actorPlayerId: myPlayer.id,
        targetPlayerId: selectedTargetId,
      });
      setHasSubmitted(true);
    } else if (myRole === 'BODYGUARD' && selectedTargetId) {
      onSubmitAction({
        actionType: 'BODYGUARD_GUARD',
        actorPlayerId: myPlayer.id,
        targetPlayerId: selectedTargetId,
      });
      setHasSubmitted(true);
    } else if (myRole === 'WITCH') {
      if (witchAction === 'HEAL') {
        onSubmitAction({
          actionType: 'WITCH_HEAL',
          actorPlayerId: myPlayer.id,
        });
        setHasSubmitted(true);
      } else if (witchAction === 'POISON' && selectedTargetId) {
        onSubmitAction({
          actionType: 'WITCH_POISON',
          actorPlayerId: myPlayer.id,
          targetPlayerId: selectedTargetId,
        });
        setHasSubmitted(true);
      }
    } else if (myRole === 'SERIAL_KILLER' && selectedTargetId) {
      onSubmitAction({
        actionType: 'SERIAL_KILL',
        actorPlayerId: myPlayer.id,
        targetPlayerId: selectedTargetId,
      });
      setHasSubmitted(true);
    } else if (myRole === 'LIEU' && selectedTargetId) {
      onSubmitAction({
        actionType: 'LIEU_SILENCE',
        actorPlayerId: myPlayer.id,
        targetPlayerId: selectedTargetId,
      });
      setHasSubmitted(true);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between max-w-4xl mx-auto space-y-4">
      {/* Top Phase Header */}
      <div className="flex items-center justify-between p-4 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 animate-pulse">
            <Moon className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-white font-serif tracking-wide flex items-center gap-2">
              <span>{isHunterRevenge ? '💥 THỢ SĂN TRẢ THÙ' : `🌙 BAN ĐÊM - VÒNG ${gameState?.roundNumber || 1}`}</span>
            </h3>
            <p className="text-xs text-zinc-400">
              {isHunterRevenge
                ? 'Thợ Săn chọn 1 người để kéo theo trước khi ngã xuống!'
                : 'Mọi người đang say ngủ, các năng lực bóng đêm bắt đầu thức tỉnh...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-2xl bg-zinc-900 border border-zinc-800 font-mono text-xs font-bold text-cyan-400">
            ⏳ {remainingSeconds}s
          </div>
          <button
            onClick={onOpenMyCard}
            className="px-3.5 py-1.5 rounded-2xl bg-purple-950/60 hover:bg-purple-900 border border-purple-700/50 text-xs font-bold text-purple-300 transition"
          >
            🃏 Lá Bài
          </button>
        </div>
      </div>

      {/* Living Players Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {room.players.map((p) => {
          const isSelected = selectedTargetId === p.id;
          const isMe = p.id === myPlayer.id;
          const isDead = !p.isAlive;
          const isWolfTeammate =
            isWerewolf && p.role && ROLES_DATABASE[p.role]?.team === 'WEREWOLF';

          return (
            <button
              key={p.id}
              disabled={isDead || (isMe && myRole !== 'BODYGUARD') || hasSubmitted}
              onClick={() => handleSelectPlayer(p)}
              className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-28 ${
                isDead
                  ? 'bg-zinc-950/40 border-zinc-900 opacity-40 cursor-not-allowed'
                  : isSelected
                  ? 'bg-zinc-800/90 border-cyan-400 ring-2 ring-cyan-500/40 shadow-xl'
                  : isMe
                  ? 'bg-zinc-900/60 border-zinc-700/80 cursor-default'
                  : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-zinc-800 to-zinc-700 flex items-center justify-center font-bold text-xs text-white border border-zinc-600">
                  {p.nickname.charAt(0).toUpperCase()}
                </div>

                {isWolfTeammate && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                    🐺 Sói
                  </span>
                )}

                {isMe && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-bold">
                    Bạn
                  </span>
                )}
              </div>

              <div>
                <div className="font-bold text-xs text-white truncate">{p.nickname}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {isDead ? '💀 Đã chết' : '✨ Còn sống'}
                </div>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 p-1 rounded-full bg-cyan-500 text-black">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Role Action Control Console */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950/80 border border-zinc-800 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-zinc-350 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Khu Vực Hành Động Của Bạn ({roleDef?.vietnameseName || 'Dân Thường'})</span>
          </div>
          {hasSubmitted && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Đã gửi hành động
            </span>
          )}
        </div>

        {/* Action prompts based on role */}
        {isWerewolf ? (
          <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-rose-200">
              🐺 <strong>Phe Ma Sói:</strong> Chọn 1 người dân làng bên trên để cắn trong đêm nay.
            </div>
            <button
              disabled={!selectedTargetId || hasSubmitted}
              onClick={handleConfirmAction}
              className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-1.5"
            >
              <Skull className="w-3.5 h-3.5" />
              <span>XÁC NHẬN CẮN</span>
            </button>
          </div>
        ) : myRole === 'SEER' ? (
          <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-cyan-200">
              🔮 <strong>Tiên Tri:</strong> Chọn 1 người chơi để soi xem họ có phải là Ma Sói hay không.
            </div>
            <button
              disabled={!selectedTargetId || hasSubmitted}
              onClick={handleConfirmAction}
              className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white shadow-lg shadow-cyan-600/30 transition flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>SOI DANH TÍNH</span>
            </button>
          </div>
        ) : myRole === 'BODYGUARD' ? (
          <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-emerald-200">
              🛡️ <strong>Bảo Vệ:</strong> Chọn 1 người để hộ vệ (họ sẽ không chết nếu bị Sói cắn đêm nay).
            </div>
            <button
              disabled={!selectedTargetId || hasSubmitted}
              onClick={handleConfirmAction}
              className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>BẢO VỆ MỤC TIÊU</span>
            </button>
          </div>
        ) : myRole === 'WITCH' ? (
          <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-3">
            <div className="text-xs text-purple-200">
              🧙‍♀️ <strong>Phù Thủy:</strong> Bạn sở hữu 1 Bình Thuốc Cứu Sinh và 1 Bình Độc Dược.
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={hasSubmitted || !nightState?.witchHasHeal}
                onClick={() => {
                  setWitchAction('HEAL');
                  handleConfirmAction();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white transition flex items-center gap-1.5"
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Dùng Bình Cứu</span>
              </button>

              <button
                disabled={hasSubmitted || !nightState?.witchHasPoison || !selectedTargetId}
                onClick={() => {
                  setWitchAction('POISON');
                  handleConfirmAction();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white transition flex items-center gap-1.5"
              >
                <Skull className="w-3.5 h-3.5" />
                <span>Dùng Bình Độc (Chọn mục tiêu)</span>
              </button>
            </div>
          </div>
        ) : myRole === 'LIEU' ? (
          <div className="p-3.5 rounded-2xl bg-emerald-950/25 border border-emerald-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-emerald-200">
              🍃 <strong>Liễu (Phe Dân):</strong> Chọn 1 người chơi để niệm chú phong ấn — người này sẽ <strong>bị khóa mic và cấm chat</strong> hoàn toàn vào ngày mai.
            </div>
            <button
              disabled={!selectedTargetId || hasSubmitted}
              onClick={handleConfirmAction}
              className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
            >
              <MicOff className="w-3.5 h-3.5" />
              <span>KHÓA MIC & CHAT</span>
            </button>
          </div>
        ) : isHunterRevenge ? (
          <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-amber-200">
              💥 <strong>Thợ Săn Trả Thù:</strong> Hãy chọn kẻ bạn nghi ngờ nhất để nổ súng!
            </div>
            <button
              disabled={!selectedTargetId || hasSubmitted}
              onClick={handleConfirmAction}
              className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white shadow-lg shadow-amber-600/30 transition flex items-center justify-center gap-1.5"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>BẮN HẠ MỤC TIÊU</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center text-xs text-zinc-400 italic">
            😴 Bạn đang chìm trong giấc ngủ say nồng... Hãy chờ đợi bình minh để bắt đầu thảo luận cùng Dân Làng!
          </div>
        )}
      </div>
    </div>
  );
};
