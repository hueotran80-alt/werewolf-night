import React, { useMemo, useState } from 'react';
import { Player, ChatMessage } from '../types';
import { PlayerAvatar } from './PlayerAvatar';
import { Crown, MessageSquare, MicOff, Volume2, UserX, Send, X } from 'lucide-react';

interface Props {
  player: Player;
  myPlayerId: string;
  isHost: boolean;
  messages: ChatMessage[];
  blockedMic: boolean;
  blockedChat: boolean;
  onToggleMicBlock: () => void;
  onToggleChatBlock: () => void;
  onKick: () => void;
  canKick?: boolean;
  onTransferHost: () => void;
  onSendPrivate: (text: string) => void;
  onClose: () => void;
}

export const PlayerInteractionModal: React.FC<Props> = ({
  player,
  myPlayerId,
  isHost,
  messages,
  blockedMic,
  blockedChat,
  onToggleMicBlock,
  onToggleChatBlock,
  onKick,
  canKick = true,
  onTransferHost,
  onSendPrivate,
  onClose,
}) => {
  const [showChat, setShowChat] = useState(false);
  const [text, setText] = useState('');

  const privateMessages = useMemo(
    () => messages.filter(
      (m) =>
        m.channel === 'PRIVATE' &&
        ((m.senderId === myPlayerId && m.recipientId === player.id) ||
          (m.senderId === player.id && m.recipientId === myPlayerId))
    ),
    [messages, myPlayerId, player.id]
  );

  const submitPrivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendPrivate(text.trim());
    setText('');
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-700 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-5 flex items-center gap-4 border-b border-zinc-800">
          <PlayerAvatar player={player} size="lg" online={player.socketConnected} />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-white text-lg truncate">{player.nickname}</div>
            <div className="text-xs text-zinc-400 flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${player.socketConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              {player.isBot ? 'Bot' : 'Người chơi'}
              {player.isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!showChat ? (
          <div className="p-4 space-y-2.5">
            <button
              onClick={() => setShowChat(true)}
              className="w-full p-3 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 flex items-center gap-3 text-sm font-bold"
            >
              <MessageSquare className="w-4 h-4" />
              Chat riêng
            </button>

            <button
              onClick={onToggleMicBlock}
              className={`w-full p-3 rounded-2xl border flex items-center gap-3 text-sm font-bold ${
                blockedMic
                  ? 'bg-amber-950/50 border-amber-700/60 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
              }`}
            >
              {blockedMic ? <Volume2 className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              {blockedMic ? 'Bỏ chặn mic' : 'Chặn mic người này'}
            </button>

            <button
              onClick={onToggleChatBlock}
              className={`w-full p-3 rounded-2xl border flex items-center gap-3 text-sm font-bold ${
                blockedChat
                  ? 'bg-amber-950/50 border-amber-700/60 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {blockedChat ? 'Bỏ chặn tin nhắn' : 'Chặn tin nhắn người này'}
            </button>

            {isHost && player.id !== myPlayerId && (
              <>
                <div className="h-px bg-zinc-800 my-2" />
                <button onClick={onTransferHost} className="w-full p-3 rounded-2xl bg-amber-950/30 border border-amber-800/50 text-amber-300 flex items-center gap-3 text-sm font-bold">
                  <Crown className="w-4 h-4" /> Trao quyền Quản Trò
                </button>
                {canKick && <button onClick={onKick} className="w-full p-3 rounded-2xl bg-rose-950/30 border border-rose-800/50 text-rose-300 flex items-center gap-3 text-sm font-bold">
                  <UserX className="w-4 h-4" /> Xóa người chơi
                </button>}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-[430px]">
            <div className="px-4 py-3 border-b border-zinc-800 text-sm font-bold text-cyan-300">
              Chat riêng với {player.nickname}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {privateMessages.length === 0 ? (
                <div className="text-center text-xs text-zinc-500 py-10">Chưa có tin nhắn riêng.</div>
              ) : privateMessages.map((m) => (
                <div key={m.id} className={`flex ${m.senderId === myPlayerId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
                    m.senderId === myPlayerId ? 'bg-cyan-600 text-white rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={submitPrivate} className="p-3 border-t border-zinc-800 flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tin nhắn riêng..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button disabled={!text.trim()} className="p-2.5 rounded-2xl bg-cyan-600 disabled:opacity-30">
                <Send className="w-4 h-4 text-white" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
