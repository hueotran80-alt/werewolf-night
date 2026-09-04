import React, { useEffect, useMemo, useState } from 'react';
import { RoomData } from '../types';
import { Shuffle, Sparkles, Users, Check } from 'lucide-react';

interface Props {
  room: RoomData;
  onFinished: () => void;
}

export const GameStartDealScreen: React.FC<Props> = ({
  room,
  onFinished,
}) => {
  const players = useMemo(() => room.players || [], [room.players]);

  const [stage, setStage] = useState<'SHUFFLE' | 'DEAL'>('SHUFFLE');
  const [dealtCount, setDealtCount] = useState(0);

  /*
   * Tổng thời gian màn hình này phải ngắn hơn 8 giây ROLE_REVEAL
   * của server.
   *
   * 1.5s xáo bài
   * 2.2s chia bài
   * => khoảng 3.7s
   *
   * Sau đó RoleRevealScreen còn khoảng 4s để người chơi xem role.
   */
  const shuffleDuration = 1500;
  const dealDuration = 2200;
  const totalDuration = shuffleDuration + dealDuration;

  useEffect(() => {
    const shuffleTimer = window.setTimeout(() => {
      setStage('DEAL');
    }, shuffleDuration);

    const finishTimer = window.setTimeout(() => {
      onFinished();
    }, totalDuration);

    return () => {
      window.clearTimeout(shuffleTimer);
      window.clearTimeout(finishTimer);
    };
  }, [onFinished, shuffleDuration, totalDuration]);

  useEffect(() => {
    if (stage !== 'DEAL') return;

    if (players.length === 0) {
      setDealtCount(0);
      return;
    }

    setDealtCount(0);

    const intervalTime = dealDuration / players.length;

    const interval = window.setInterval(() => {
      setDealtCount((prev) => {
        if (prev >= players.length) {
          window.clearInterval(interval);
          return prev;
        }

        return prev + 1;
      });
    }, intervalTime);

    return () => {
      window.clearInterval(interval);
    };
  }, [stage, players.length, dealDuration]);

  const progress =
    players.length > 0
      ? Math.min(
          100,
          Math.round((dealtCount / players.length) * 100)
        )
      : 100;

  return (
    <div className="fixed inset-0 z-40 bg-[#04060C] text-white overflow-hidden flex items-center justify-center p-4">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-indigo-900/20 blur-3xl" />

        <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-rose-950/10 blur-3xl" />

        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-blue-950/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-5 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-[10px] sm:text-xs text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />

            <span>
              NGHI THỨC BẮT ĐẦU TRẬN
            </span>
          </div>

          <h1 className="mt-3 text-2xl sm:text-4xl font-serif font-black tracking-[0.18em] uppercase">
            {stage === 'SHUFFLE'
              ? 'XÁO BÀI'
              : 'CHIA BÀI'}
          </h1>

          <p className="mt-2 text-xs sm:text-sm text-zinc-400">
            {stage === 'SHUFFLE'
              ? 'Quản Trò đang xáo bộ bài bí mật...'
              : 'Mỗi người chơi nhận một lá bài úp.'}
          </p>
        </div>

        {/* Bộ bài ở giữa */}
        <div className="relative h-52 sm:h-64 w-full flex items-center justify-center">
          <div
            className={`relative w-28 sm:w-36 aspect-[245/328] ${
              stage === 'SHUFFLE'
                ? 'animate-[cardShuffle_0.55s_ease-in-out_infinite]'
                : ''
            }`}
          >
            {/* Lá chính */}
            <img
              src="/cards/back.png"
              alt="Bộ bài"
              className="w-full h-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.65)]"
            />

            {/* Lá phụ khi xáo */}
            {stage === 'SHUFFLE' && (
              <>
                <div className="absolute -left-10 top-8 w-20 aspect-[245/328] opacity-35 -rotate-12">
                  <img
                    src="/cards/back.png"
                    alt=""
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="absolute -right-10 top-8 w-20 aspect-[245/328] opacity-35 rotate-12">
                  <img
                    src="/cards/back.png"
                    alt=""
                    className="w-full h-full object-contain"
                  />
                </div>
              </>
            )}

            {stage === 'DEAL' && (
              <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1.5 text-[10px] text-cyan-300">
                <Shuffle className="w-3 h-3" />
                Đang phân phát...
              </div>
            )}
          </div>
        </div>

        {/* Danh sách người chơi */}
        <div className="w-full mt-4">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Người chơi
            </span>

            <span className="font-mono text-cyan-300">
              {dealtCount}/{players.length}
            </span>
          </div>

          {/* Progress */}
          <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-amber-400 transition-all duration-200"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          {/* Player cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-[34vh] overflow-y-auto pr-1">
            {players.map((player, index) => {
              const isDealt = index < dealtCount;

              return (
                <div
                  key={player.id}
                  className={`relative rounded-xl border px-2.5 py-2 transition-all duration-300 ${
                    isDealt
                      ? 'bg-zinc-900/80 border-cyan-500/30'
                      : 'bg-zinc-950/60 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Lá bài nhỏ */}
                    <div
                      className={`relative shrink-0 w-8 h-10 rounded-md overflow-hidden transition-all duration-300 ${
                        isDealt
                          ? 'opacity-100'
                          : 'opacity-40'
                      }`}
                    >
                      <img
                        src="/cards/back.png"
                        alt=""
                        className="w-full h-full object-cover"
                      />

                      {isDealt && (
                        <span className="absolute -right-0.5 -top-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] sm:text-xs text-zinc-300 truncate">
                      {player.nickname}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cardShuffle {
          0%, 100% {
            transform: translateX(0) rotate(0deg);
          }

          25% {
            transform: translateX(-24px) rotate(-8deg);
          }

          50% {
            transform: translateX(24px) rotate(8deg);
          }

          75% {
            transform: translateX(-12px) rotate(-4deg);
          }
        }
      `}</style>
    </div>
  );
};