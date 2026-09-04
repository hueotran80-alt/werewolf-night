import React, { useState, useRef, useEffect } from 'react';
import { Player, RoomData, RoleId, ChatMessage } from '../types';
import { useGame } from '../context/GameContext';
import {
  Sun,
  MessageSquare,
  Send,
  ShieldAlert,
  MicOff,
  VolumeX,
} from 'lucide-react';

interface Props {
  room: RoomData;
  myPlayer: Player;
  myRole: RoleId | null;
  chatMessages: ChatMessage[];
  onSendChat: (
    text: string,
    channel: 'DAY_PUBLIC' | 'GHOST_PRIVATE'
  ) => void;
  onOpenMyCard: () => void;
}

export const DayPhaseView: React.FC<Props> = ({
  room,
  myPlayer,
  chatMessages,
  onSendChat,
  onOpenMyCard,
}) => {
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { isSilenced } = useGame();

  const gameState = room.gameState;

  const victims = gameState?.lastNightVictims || [];

  const isAnnouncement =
    gameState?.currentPhase === 'DAY_ANNOUNCEMENT';

  const isDeathRebuttal =
    gameState?.currentPhase === 'DEATH_REBUTTAL';

  const canRebuttal =
    isDeathRebuttal &&
    !myPlayer.isAlive &&
    !!gameState?.deathRebuttalPlayerIds?.includes(myPlayer.id);

  const isAlive = myPlayer.isAlive;

  const silencedPlayers = room.players.filter(
    (p) => p.isSilenced && p.isAlive
  );


  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    gameState?.phaseEndsAt
      ? Math.max(
          0,
          Math.ceil(
            (gameState.phaseEndsAt - Date.now()) / 1000
          )
        )
      : 60
  );

  useEffect(() => {
    const updateTimer = () => {
      const endsAt = gameState?.phaseEndsAt;

      if (!endsAt) {
        setRemainingSeconds(60);
        return;
      }

      const remaining = Math.max(
        0,
        Math.ceil((endsAt - Date.now()) / 1000)
      );

      setRemainingSeconds(remaining);
    };

    // Cập nhật ngay khi phase thay đổi
    updateTimer();

    /*
     * Cập nhật thường xuyên để đồng hồ không phụ thuộc
     * vào việc component có nhận event/click mới hay không.
     */
    const interval = window.setInterval(
      updateTimer,
      250
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [gameState?.phaseEndsAt]);

  /*
   * Người bị loại bởi vote.
   *
   * Server đã lưu người nhận nhiều phiếu nhất tại
   * lastDayEliminated.
   */
  const rebuttalTarget =
    gameState?.lastDayEliminated;

  /*
   * Chỉ hiển thị:
   * - chat công khai ban ngày
   * - ghost chat nếu người xem đã chết
   */
  const relevantMessages = chatMessages.filter(
    (m) =>
      m.channel === 'DAY_PUBLIC' ||
      (m.channel === 'GHOST_PRIVATE' && !isAlive)
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [relevantMessages]);

  /*
   * Gửi chat.
   *
   * Người đang phản biện được dùng DAY_PUBLIC
   * thay vì GHOST_PRIVATE.
   */
  const handleSendMessage = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!inputText.trim()) return;

    onSendChat(
      inputText,
      isAlive || canRebuttal
        ? 'DAY_PUBLIC'
        : 'GHOST_PRIVATE'
    );

    setInputText('');
  };

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col max-w-4xl mx-auto space-y-2 sm:space-y-4">

      {/* ========================================================
          HEADER
      ======================================================== */}
      <div className="flex items-center justify-between p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-amber-950/20 border border-amber-800/40 backdrop-blur-md fantasy-panel">

        <div className="flex items-center gap-3">

          <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Sun className="w-5 h-5" />
          </span>

          <div>

            <h3 className="text-base font-bold text-white font-serif tracking-wide">
              ☀️ BAN NGÀY - VÒNG{' '}
              {gameState?.roundNumber || 1}
            </h3>

            <p className="text-xs text-amber-200/80">

              {isDeathRebuttal ? (

                rebuttalTarget ? (
                  <>
                    <strong className="text-white">
                      {rebuttalTarget.playerName}
                    </strong>{' '}
                    đang phản biện — nhận{' '}
                    <strong className="text-rose-300">
                      {rebuttalTarget.votesReceived}
                    </strong>{' '}
                    phiếu.
                  </>
                ) : (
                  'Người vừa chết đang có 30 giây để phản biện cuối cùng.'
                )

              ) : isAnnouncement ? (

                'Quản Trò đang công bố danh sách nạn nhân đêm qua...'

              ) : (

                'Thời gian thảo luận tự do! Hãy chất vấn và tìm ra Ma Sói.'

              )}

            </p>

          </div>
        </div>

        <div className="flex items-center gap-2">

          {/* TIMER */}
          <div
            className={`px-3.5 py-1.5 rounded-2xl bg-zinc-900 border font-mono text-xs font-bold ${
              isDeathRebuttal
                ? 'border-rose-800 text-rose-400'
                : 'border-zinc-800 text-amber-400'
            }`}
          >
            ⏳ {remainingSeconds}s
          </div>

          <button
            type="button"
            onClick={onOpenMyCard}
            className="px-3.5 py-1.5 rounded-2xl bg-purple-950/60 hover:bg-purple-900 border border-purple-700/50 text-xs font-bold text-purple-300 transition"
          >
            🃏 Lá Bài
          </button>

        </div>
      </div>


      {/* ========================================================
          KẾT QUẢ VOTE + NGƯỜI ĐANG PHẢN BIỆN
      ======================================================== */}
      {isDeathRebuttal && rebuttalTarget && (
        <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-rose-950/40 border border-amber-800/40 shadow-xl">

          <div className="flex items-center justify-between gap-4">

            <div>

              <div className="text-[10px] uppercase tracking-wider font-bold text-rose-300">
                ⚖️ KẾT QUẢ BỎ PHIẾU
              </div>

              <div className="mt-1 text-lg font-bold text-white">
                {rebuttalTarget.playerName}
              </div>

              <div className="text-xs text-rose-200 mt-1">
                Người nhận nhiều phiếu nhất
                {' · '}
                <strong>
                  {rebuttalTarget.votesReceived}
                </strong>{' '}
                phiếu
              </div>

            </div>

            <div className="text-center px-4 py-2 rounded-2xl bg-zinc-950 border border-rose-800/60 min-w-[110px]">

              <div className="text-[10px] text-zinc-500">
                ĐANG PHẢN BIỆN
              </div>

              <div className="font-mono text-xl font-bold text-amber-400">
                {remainingSeconds}s
              </div>

            </div>

          </div>

        </div>
      )}


      {/* ========================================================
          MORNING ANNOUNCEMENT
      ======================================================== */}
      <div className="p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl fantasy-panel shadow-xl space-y-2">

        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">

          <ShieldAlert className="w-4 h-4 text-amber-400" />

          <span>
            Thông Báo Buổi Sáng:
          </span>

        </div>

        {victims.length === 0 ? (

          <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300 font-semibold flex items-center gap-2">

            ✨ Đêm qua là một đêm bình yên kỳ lạ!
            Không có nạn nhân nào thiệt mạng.

          </div>

        ) : (

          <div className="space-y-1.5">

            {victims.map((v, idx) => (

              <div
                key={idx}
                className="p-3 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 flex items-center justify-between"
              >

                <span>
                  💀 <strong>{v.playerName}</strong>{' '}
                  đã ngã xuống trong đêm
                </span>

                {room.settings.revealRoleOnDeath &&
                  v.roleName && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-rose-900/60 text-rose-200 border border-rose-700/50">
                      Vai trò:
                    </span>
                  )}

              </div>

            ))}

          </div>

        )}

        {/* Silenced Players */}

        {silencedPlayers.length > 0 && (
          <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-800/50 text-xs text-amber-300 font-medium flex items-center gap-2">

            <MicOff className="w-4 h-4 text-amber-400 flex-shrink-0" />

            <span>
              🍃 <strong>Phong Ấn Câm Lặng:</strong>{' '}
              {silencedPlayers
                .map((p) => p.nickname)
                .join(', ')}{' '}
              đã bị <strong>Liễu</strong> phong ấn
              đêm qua — không thể mở mic hoặc gửi
              tin nhắn chat trong ngày hôm nay!
            </span>

          </div>
        )}

      </div>


      {/* ========================================================
          TOWN HALL CHAT
      ======================================================== */}
      <div className="flex-1 min-h-0 flex flex-col bg-zinc-950/80 border border-zinc-800 rounded-3xl shadow-xl overflow-hidden min-h-[220px]">

        <div className="p-3 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between px-4">

          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">

            <MessageSquare className="w-4 h-4 text-cyan-400" />

            <span>
              Kênh Hội đồng Làng{' '}
              {isAlive
                ? '(Công khai)'
                : '👻 (Cõi Âm)'}
            </span>

          </div>

          <span className="text-[10px] text-zinc-400">
            {
              room.players.filter(
                (p) => p.isAlive
              ).length
            }{' '}
            người sống
          </span>

        </div>


        {/* MESSAGE LOG */}

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-64">

          {relevantMessages.length === 0 ? (

            <div className="text-center text-xs text-zinc-400 py-8">
              Chưa có tin nhắn nào. Hãy bắt đầu
              chất vấn kẻ tình nghi!
            </div>

          ) : (

            relevantMessages.map((msg, idx) => {

              const isSenderMe =
                msg.senderId === myPlayer.id;

              const isGhostChat =
                msg.channel === 'GHOST_PRIVATE';

              return (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col ${
                    isSenderMe
                      ? 'items-end'
                      : 'items-start'
                  }`}
                >

                  <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-zinc-400">

                    <span className="font-semibold text-zinc-300">
                      {isSenderMe
                        ? 'Bạn'
                        : msg.senderName}
                    </span>

                    {isGhostChat && (
                      <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[9px]">
                        Linh Hồn
                      </span>
                    )}

                  </div>

                  <div
                    className={`p-3 rounded-2xl text-xs max-w-[80%] leading-relaxed ${
                      isSenderMe
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : isGhostChat
                        ? 'bg-purple-950/60 border border-purple-800 text-purple-200 rounded-tl-sm'
                        : 'bg-zinc-800/90 text-zinc-200 rounded-tl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>

                </div>
              );
            })

          )}

          <div ref={chatEndRef} />

        </div>


        {/* ======================================================
            CHAT INPUT
        ====================================================== */}

        {isSilenced ? (

          <div className="p-3.5 border-t border-zinc-800 bg-amber-950/20 flex items-center justify-center gap-2 text-xs text-amber-300 font-semibold">

            <VolumeX className="w-4 h-4 text-amber-400" />

            <span>
              🤐 Bạn đang bị Liễu phong ấn câm lặng!
              Không thể mở mic hoặc gửi chat trong
              ngày hôm nay.
            </span>

          </div>

        ) : (

          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-zinc-800 bg-zinc-950 flex gap-2"
          >

            <input
              type="text"
              placeholder={
                isAlive
                  ? 'Nhập tin nhắn thảo luận, phản biện...'
                  : canRebuttal
                  ? 'Nhập lời phản biện cuối cùng...'
                  : 'Bạn đã chết. Chỉ có thể trò chuyện với các Linh Hồn khác...'
              }
              value={inputText}
              onChange={(e) =>
                setInputText(e.target.value)
              }
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
            />

            <button
              type="submit"
              disabled={
                !inputText.trim() ||
                (!isAlive && !canRebuttal)
              }
              className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5"
            >

              <Send className="w-3.5 h-3.5" />

              <span>
                Gửi
              </span>

            </button>

          </form>

        )}

      </div>

    </div>
  );
};