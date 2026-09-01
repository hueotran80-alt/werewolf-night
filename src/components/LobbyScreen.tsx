import React, { useState } from 'react';
import { RoomData, Player, DeckCardConfig, RoomSettings, ChatMessage } from '../types';
import { ROLES_DATABASE } from '../data/rolesData';
import { DeckBuilderModal } from './DeckBuilderModal';
import { useGame } from '../context/GameContext';
import { safeCopyToClipboard } from '../lib/storage';
import {
  Users,
  Copy,
  Check,
  Crown,
  Play,
  Bot,
  UserX,
  Sparkles,
  Layers,
  Settings,
  Send,
  MessageSquare,
  LogOut,
  Share2,
  Mic,
  MicOff,
  Volume2,
} from 'lucide-react';

interface Props {
  room: RoomData;
  myPlayer: Player;
  isHost: boolean;
  chatMessages: ChatMessage[];
  onStartGame: () => void;
  onUpdateDeck: (newDeck: DeckCardConfig[]) => void;
  onUpdateSettings: (newSettings: Partial<RoomSettings>) => void;
  onAddBot: () => void;
  onKickPlayer: (playerId: string) => void;
  onTransferHost: (playerId: string) => void;
  onLeaveRoom: () => void;
  onSendChat: (text: string, channel: 'LOBBY') => void;
}

export const LobbyScreen: React.FC<Props> = ({
  room,
  myPlayer,
  isHost,
  chatMessages,
  onStartGame,
  onUpdateDeck,
  onUpdateSettings,
  onAddBot,
  onKickPlayer,
  onTransferHost,
  onLeaveRoom,
  onSendChat,
}) => {
  const [copied, setCopied] = useState(false);
  const [showDeckBuilder, setShowDeckBuilder] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [inputText, setInputText] = useState('');

  const { voiceStates } = useGame();

  const totalCards = room.deck.reduce((sum, c) => sum + c.count, 0);
  const playerCount = room.players.length;
  const isDeckBalanced = totalCards === playerCount && playerCount >= 6;

  const handleCopyCode = async () => {
    await safeCopyToClipboard(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendChat(inputText, 'LOBBY');
    setInputText('');
  };

  return (
    <div className="w-full flex-1 max-w-5xl mx-auto space-y-5 animate-fade-in p-2 sm:p-4">
      {/* Top Room Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950/80 border border-zinc-800 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black font-mono tracking-widest text-white">
                {room.code}
              </h2>
              <button
                onClick={handleCopyCode}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                title="Sao chép mã phòng"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Chế độ: <strong>{room.settings.mode === 'TWO_TEAM' ? '2 Phe (Dân vs Sói)' : '3 Phe (Có Độc Lập)'}</strong> •{' '}
              {playerCount}/{room.settings.maxPlayers} Người chơi
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {isHost && (
            <>
              <button
                onClick={onAddBot}
                disabled={playerCount >= room.settings.maxPlayers}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-bold text-zinc-200 flex items-center gap-1.5 transition"
              >
                <Bot className="w-4 h-4 text-cyan-400" />
                <span>+ Thêm Bot Test</span>
              </button>

              <button
                onClick={() => setShowDeckBuilder(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-700/50 text-xs font-bold text-purple-300 flex items-center gap-1.5 transition"
              >
                <Layers className="w-4 h-4" />
                <span>Chỉnh Bộ Bài</span>
              </button>
            </>
          )}

          <button
            onClick={onLeaveRoom}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition"
            title="Rời phòng"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Grid: Left Players & Deck, Right Lobby Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Player List & Deck Overview (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Players Container */}
          <div className="p-5 rounded-3xl bg-zinc-950/80 border border-zinc-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
              <span>Danh Sách Người Chơi ({playerCount})</span>
              {playerCount < 6 && (
                <span className="text-amber-400 font-normal lowercase text-[11px]">
                  (cần tối thiểu 6 người để bắt đầu)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {room.players.map((p) => {
                const isMe = p.id === myPlayer.id;
                const pVoice = voiceStates[p.id];
                const isSpeaking = pVoice && !pVoice.isMuted && pVoice.isSpeaking;
                const isMuted = !pVoice || pVoice.isMuted;

                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between relative transition-all ${
                      isSpeaking
                        ? 'bg-zinc-900 border-emerald-500 ring-2 ring-emerald-500/30'
                        : isMe
                        ? 'bg-zinc-900/80 border-cyan-500/50'
                        : 'bg-zinc-900/40 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {p.nickname.charAt(0).toUpperCase()}
                        </div>
                        {isSpeaking && (
                          <span className="absolute -inset-0.5 rounded-xl border border-emerald-400 animate-ping opacity-60" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                          <span>{p.nickname}</span>
                          {p.isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                          {p.isBot && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                              BOT
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                          <span>{isMe ? '👤 Bạn' : p.socketConnected ? '🟢 Online' : '🔴 Mất kết nối'}</span>
                          <span>•</span>
                          {isSpeaking ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                              <Volume2 className="w-3 h-3" /> Đang nói
                            </span>
                          ) : isMuted ? (
                            <span className="text-zinc-500 flex items-center gap-0.5">
                              <MicOff className="w-2.5 h-2.5" /> Mic tắt
                            </span>
                          ) : (
                            <span className="text-emerald-400/80 flex items-center gap-0.5">
                              <Mic className="w-2.5 h-2.5" /> Mic bật
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Host tools for other players */}
                    {isHost && !isMe && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onTransferHost(p.id)}
                          className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 transition"
                          title="Chuyển quyền Quản Trò"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onKickPlayer(p.id)}
                          className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition"
                          title="Đuổi khỏi phòng"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deck Cards Preview Bar */}
          <div className="p-4 rounded-3xl bg-zinc-950/80 border border-zinc-800 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
              <span>Bộ Bài Đã Chọn ({totalCards} Thẻ)</span>
              {isHost && (
                <button
                  onClick={() => setShowDeckBuilder(true)}
                  className="text-cyan-400 hover:underline capitalize"
                >
                  Thay đổi
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {room.deck.map((card) => {
                const role = ROLES_DATABASE[card.roleId];
                if (!role) return null;

                return (
                  <div
                    key={card.roleId}
                    className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-1.5 text-xs text-zinc-200"
                  >
                    <span className="font-semibold">{role.vietnameseName}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-800 text-cyan-300">
                      x{card.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Host Start Game Button */}
          {isHost ? (
            <button
              disabled={!isDeckBalanced}
              onClick={onStartGame}
              className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-2xl transition active:scale-95 ${
                isDeckBalanced
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>
                {playerCount < 6
                  ? `CẦN TỐI THIỂU 6 NGƯỜI CHƠI (${playerCount}/6)`
                  : totalCards !== playerCount
                  ? `SỐ THẺ (${totalCards}) CHƯA BẰNG SỐ NGƯỜI (${playerCount})`
                  : 'BẮT ĐẦU TRẬN ĐẤU MA SÓI'}
              </span>
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center text-xs text-zinc-400">
              ⏳ Đang chờ Quản Trò <strong>{room.players.find((p) => p.isHost)?.nickname}</strong> cấu hình bộ bài và bắt đầu trận đấu...
            </div>
          )}
        </div>

        {/* Right Column: Lobby Chat (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col bg-zinc-950/80 border border-zinc-800 rounded-3xl shadow-xl overflow-hidden h-[420px]">
          <div className="p-3.5 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2 text-xs font-bold text-zinc-300">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span>Kênh Trò Chuyện Sảnh Chờ</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
            {chatMessages.filter((m) => m.channel === 'LOBBY').length === 0 ? (
              <div className="text-center text-xs text-zinc-500 py-12">
                Hãy gửi lời chào đến những người chơi khác trong phòng!
              </div>
            ) : (
              chatMessages
                .filter((m) => m.channel === 'LOBBY')
                .map((msg) => {
                  const isSenderMe = msg.senderId === myPlayer.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isSenderMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="text-[10px] text-zinc-400 mb-0.5 font-medium">
                        {isSenderMe ? 'Bạn' : msg.senderName}
                      </div>
                      <div
                        className={`p-2.5 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                          isSenderMe
                            ? 'bg-cyan-600 text-white rounded-tr-sm'
                            : 'bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-tl-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-2.5 border-t border-zinc-800 bg-zinc-950 flex gap-2">
            <input
              type="text"
              placeholder="Nhập tin nhắn sảnh chờ..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Deck Builder Modal */}
      <DeckBuilderModal
        isOpen={showDeckBuilder}
        onClose={() => setShowDeckBuilder(false)}
        currentDeck={room.deck}
        playerCount={playerCount}
        settings={room.settings}
        onSaveDeck={onUpdateDeck}
      />
    </div>
  );
};