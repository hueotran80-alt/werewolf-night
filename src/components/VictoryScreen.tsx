import React, { useState } from 'react';
import { RoomData, Player, RoleId } from '../types';
import { ROLES_DATABASE } from '../data/rolesData';
import { RoleCardIllustration } from './RoleCardIllustration';
import { Trophy, RefreshCw, Home, History, Users, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  room: RoomData;
  myPlayer: Player;
  isHost: boolean;
  onRestart: () => void;
  onReturnToLobby: () => void;
  onGoHome: () => void;
}

export const VictoryScreen: React.FC<Props> = ({
  room,
  myPlayer,
  isHost,
  onRestart,
  onReturnToLobby,
  onGoHome,
}) => {
  const [showLogs, setShowLogs] = useState(true);

  const gameState = room.gameState;
  const winner = gameState?.winnerTeam || 'VILLAGE';
  const winnerMessage = gameState?.winnerMessage || 'Trận đấu đã khép lại!';

  const getWinnerBadge = () => {
    switch (winner) {
      case 'WEREWOLF':
        return {
          title: '🐺 PHE MA SÓI CHIẾN THẮNG!',
          color: 'from-rose-600 to-red-900 border-rose-500',
          text: 'text-rose-400',
        };
      case 'JESTER':
        return {
          title: '🎭 KẺ HỀ CHIẾN THẮNG SOLO!',
          color: 'from-pink-600 to-purple-900 border-pink-500',
          text: 'text-pink-400',
        };
      case 'SERIAL_KILLER':
        return {
          title: '🔪 KẺ SÁT NHÂN CHIẾN THẮNG SOLO!',
          color: 'from-purple-700 to-indigo-950 border-purple-500',
          text: 'text-purple-400',
        };
      default:
        return {
          title: '☀️ PHE DÂN LÀNG CHIẾN THẮNG!',
          color: 'from-blue-600 to-cyan-900 border-blue-500',
          text: 'text-blue-400',
        };
    }
  };

  const badge = getWinnerBadge();

  return (
    <div className="w-full flex-1 max-w-4xl mx-auto space-y-6 animate-fade-in p-2 sm:p-4">
      {/* Hero Victory Card */}
      <div
        className={`p-6 sm:p-8 rounded-3xl bg-gradient-to-b ${badge.color} border shadow-2xl text-center space-y-3 relative overflow-hidden`}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto text-amber-300 shadow-lg">
          <Trophy className="w-8 h-8" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-wider uppercase text-white drop-shadow-md">
          {badge.title}
        </h2>
        <p className="text-xs sm:text-sm text-zinc-100/90 max-w-xl mx-auto leading-relaxed">
          {winnerMessage}
        </p>

        <div className="pt-2 flex flex-wrap justify-center gap-3">
          {isHost && (
            <button
              onClick={onRestart}
              className="px-5 py-2.5 rounded-2xl bg-white text-zinc-900 font-bold text-xs hover:bg-zinc-100 shadow-lg transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Chơi Tiếp Trận Mới</span>
            </button>
          )}

          {isHost && (
            <button
              onClick={onReturnToLobby}
              className="px-5 py-2.5 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/20 text-white font-bold text-xs transition flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              <span>Quay Lại Sảnh Chờ</span>
            </button>
          )}

          <button
            onClick={onGoHome}
            className="px-5 py-2.5 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/20 text-white font-bold text-xs transition flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Trang Chủ</span>
          </button>
        </div>
      </div>

      {/* Full Roles Reveal Grid */}
      <div className="p-5 rounded-3xl bg-zinc-950/80 border border-zinc-800 shadow-xl space-y-4">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Danh Tính Thật Của Tất Cả Người Chơi (Role Reveal):</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {room.players.map((p) => {
            const role = p.role ? ROLES_DATABASE[p.role] : null;

            return (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-3"
              >
                {p.role ? (
                  <RoleCardIllustration roleId={p.role} size="sm" showDetails={false} />
                ) : (
                  <div className="w-12 h-16 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-zinc-500 text-xs">
                    ?
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white truncate flex items-center gap-1">
                    <span>{p.nickname}</span>
                    {p.id === myPlayer.id && (
                      <span className="text-[10px] text-cyan-400 font-normal">(Bạn)</span>
                    )}
                  </div>
                  <div className="text-xs font-serif font-semibold text-zinc-300 mt-0.5">
                    {role?.vietnameseName || 'Ẩn'}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {p.isAlive ? (
                      <span className="text-emerald-400">✨ Sống sót</span>
                    ) : (
                      <span className="text-rose-400">💀 {p.deathReason || 'Đã chết'}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Game Replay Logs */}
      <div className="p-5 rounded-3xl bg-zinc-950/80 border border-zinc-800 shadow-xl space-y-3">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span>Nhật Ký Toàn Bộ Ván Đấu ({gameState?.logs.length || 0} Sự Kiện):</span>
          </div>
          {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showLogs && (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {gameState?.logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-2.5"
              >
                <span className="font-mono text-[10px] text-zinc-500 flex-shrink-0 mt-0.5">
                  V.{log.round}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                      {log.phase.replaceAll('_', ' ')}
                    </span>
                    <span className="text-[9px] text-zinc-600">
                      {new Date(log.timestamp).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <span className="leading-relaxed">{log.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
