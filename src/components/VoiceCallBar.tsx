// ============================================================================
// WEREWOLF: NIGHT OF DECEPTION - Voice Call Floating Bar & Audio Status
// ============================================================================

import React from 'react';
import { useGame } from '../context/GameContext';
import { VoiceUserState } from '../types';
import { Mic, MicOff, Headphones, VolumeX, Radio, Sparkles, ShieldAlert } from 'lucide-react';

export const VoiceCallBar: React.FC = () => {
  const {
    currentRoom,
    gameState,
    myPlayer,
    voiceStates,
    isMyMicMuted,
    isMySpeaking,
    isMyDeafened,
    myAudioLevel,
    toggleMic,
    toggleDeafen,
    isSilenced,
  } = useGame();

  if (!currentRoom) return null;

  const currentPhase = gameState?.currentPhase || 'LOBBY';
  const isNight = currentPhase === 'NIGHT' || currentPhase === 'ROLE_REVEAL' || currentPhase === 'HUNTER_REVENGE';
  const isLiving = myPlayer ? myPlayer.isAlive : true;
  const isGameActive = !!gameState && currentPhase !== 'LOBBY' && currentPhase !== 'GAME_OVER';

  // Find other players who are currently speaking
  const activeSpeakers = (Object.values(voiceStates) as VoiceUserState[]).filter((v) => !v.isMuted && v.isSpeaking);

  return (
    <div className="w-full max-w-4xl mx-auto mb-3">
      <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-850 backdrop-blur-xl shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Left: Call Status & Channel Indicator */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                isNight
                  ? 'bg-indigo-950/70 border border-indigo-800 text-indigo-400'
                  : isSilenced
                  ? 'bg-amber-950/80 border border-amber-800 text-amber-400'
                  : !isMyMicMuted
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
              }`}
            >
              {isNight ? (
                <Radio className="w-4 h-4 opacity-50" />
              ) : isSilenced ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Radio className={`w-4 h-4 ${!isMyMicMuted ? 'animate-pulse text-emerald-400' : ''}`} />
              )}
            </div>

            {/* Speaking audio wave ring */}
            {isMySpeaking && !isMyMicMuted && (
              <span className="absolute -inset-1 rounded-2xl border-2 border-emerald-500 animate-ping pointer-events-none opacity-40" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Kênh Thoại Phòng</span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </span>

              {isNight && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-semibold">
                  🌙 Đêm: Mic Tắt Tự Động
                </span>
              )}

              {isSilenced && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-semibold flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-400" /> Bị Liễu Khóa Mic & Chat
                </span>
              )}
            </div>

            <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
              {isNight ? (
                <span>Tất cả người chơi bị câm lặng trong đêm để bảo mật danh tính.</span>
              ) : isSilenced ? (
                <span className="text-amber-300/90 font-medium">Bạn đã bị Liễu chọn trúng đêm qua. Không thể bật mic.</span>
              ) : activeSpeakers.length > 0 ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {activeSpeakers.map((s) => s.nickname).join(', ')} đang nói...
                </span>
              ) : (
                <span>Trò chuyện trực tiếp cùng mọi người trong phòng</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Audio Level Bar & Control Buttons */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* Audio Input Level indicator */}
          {!isMyMicMuted && !isNight && !isSilenced && (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, myAudioLevel)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-zinc-400">{myAudioLevel}%</span>
            </div>
          )}

          {/* Deafen Button */}
          <button
            onClick={toggleDeafen}
            title={isMyDeafened ? 'Bật âm thanh phòng' : 'Tắt âm thanh phòng'}
            className={`p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isMyDeafened
                ? 'bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/80'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {isMyDeafened ? <VolumeX className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
            <span className="hidden md:inline">{isMyDeafened ? 'Điếc' : 'Nghe'}</span>
          </button>

          {/* Mic Toggle Button */}
          <button
            onClick={toggleMic}
            disabled={isNight || isSilenced || (!isLiving && isGameActive)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              isNight || isSilenced || (!isLiving && isGameActive)
                ? 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                : !isMyMicMuted
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/30 ring-2 ring-emerald-500/30'
                : 'bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300'
            }`}
          >
            {isNight ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Đêm Đã Tắt</span>
              </>
            ) : isSilenced ? (
              <>
                <MicOff className="w-4 h-4 text-amber-400" />
                <span>Bị Phong Ấn</span>
              </>
            ) : !isMyMicMuted ? (
              <>
                <Mic className="w-4 h-4 animate-bounce" />
                <span>Đang Bật Mic</span>
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4 text-rose-400" />
                <span>Bật Mic</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
