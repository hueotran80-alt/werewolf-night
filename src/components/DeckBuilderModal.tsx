import React, { useState, useEffect } from 'react';
import { DeckCardConfig, RoleId, RoomSettings } from '../types';
import { ROLES_DATABASE, DECK_PRESETS } from '../data/rolesData';
import { RoleCardIllustration } from './RoleCardIllustration';
import { X, Plus, Minus, Check, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentDeck: DeckCardConfig[];
  playerCount: number;
  settings: RoomSettings;
  onSaveDeck: (newDeck: DeckCardConfig[]) => void;
}

export const DeckBuilderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentDeck,
  playerCount,
  settings,
  onSaveDeck,
}) => {
  const [deck, setDeck] = useState<DeckCardConfig[]>(currentDeck);
  const [selectedRoleForDetail, setSelectedRoleForDetail] = useState<RoleId>('WEREWOLF');

  useEffect(() => {
    setDeck(currentDeck);
  }, [currentDeck, isOpen]);

  if (!isOpen) return null;

  const totalCards = deck.reduce((sum, item) => sum + item.count, 0);

  // Count by team
  let wolfCount = 0;
  let villageCount = 0;
  let neutralCount = 0;

  deck.forEach((item) => {
    const r = ROLES_DATABASE[item.roleId];
    if (r) {
      if (r.team === 'WEREWOLF') wolfCount += item.count;
      if (r.team === 'VILLAGE') villageCount += item.count;
      if (r.team === 'NEUTRAL') neutralCount += item.count;
    }
  });

  // Check validation rules
  const errors: string[] = [];
  if (totalCards !== playerCount) {
    errors.push(`Số lượng thẻ bài (${totalCards}) cần bằng đúng số người chơi trong phòng (${playerCount}).`);
  }
  if (wolfCount === 0) {
    errors.push('Bắt buộc phải có ít nhất 1 Ma Sói trong bộ bài.');
  }
  if (villageCount === 0) {
    errors.push('Bắt buộc phải có ít nhất 1 Dân Làng trong bộ bài.');
  }
  if (wolfCount >= villageCount + neutralCount && totalCards > 0) {
    errors.push('Phe Ma Sói đang áp đảo ngay từ đầu. Cần thêm vai trò Dân Làng!');
  }
  if (settings.mode === 'TWO_TEAM' && neutralCount > 0) {
    errors.push('Chế độ 2 Phe không cho phép có thẻ bài Phe Độc Lập.');
  }

  const isValid = errors.length === 0;

  const updateCardCount = (roleId: RoleId, delta: number) => {
    const roleDef = ROLES_DATABASE[roleId];
    if (!roleDef) return;

    setDeck((prev) => {
      const existing = prev.find((x) => x.roleId === roleId);
      const currentCount = existing ? existing.count : 0;
      const newCount = Math.max(0, Math.min(roleDef.maxPerGame, currentCount + delta));

      if (existing) {
        if (newCount === 0) {
          return prev.filter((x) => x.roleId !== roleId);
        }
        return prev.map((x) => (x.roleId === roleId ? { ...x, count: newCount } : x));
      } else if (newCount > 0) {
        return [...prev, { roleId, count: newCount }];
      }
      return prev;
    });
  };

  const applyPreset = (presetDeck: DeckCardConfig[]) => {
    setDeck(presetDeck);
  };

  const handleSave = () => {
    if (isValid) {
      onSaveDeck(deck);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl max-h-[90vh] bg-[#0B0F19] border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white font-serif tracking-wide">
                  TÙY CHỈNH BỘ BÀI (DECK BUILDER)
                </h3>
                <p className="text-xs text-zinc-400">
                  Cân bằng tỷ lệ sức mạnh giữa Phe Sói, Phe Dân & Phe Độc Lập
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Quick Presets Bar */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Bộ bài mẫu gợi ý:
            </div>
            <div className="flex flex-wrap gap-2">
              {DECK_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.deck)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{p.name}</span>
                  <span className="text-[10px] text-zinc-400">({p.minPlayers}-{p.maxPlayers} người)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats & Balance Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800">
            <div className="text-center p-2 rounded-xl bg-zinc-900/50">
              <div className="text-[11px] text-zinc-400 font-medium">Tổng số thẻ / Người chơi</div>
              <div
                className={`text-xl font-bold font-mono mt-0.5 ${
                  totalCards === playerCount ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {totalCards} / {playerCount}
              </div>
            </div>

            <div className="text-center p-2 rounded-xl bg-rose-950/20 border border-rose-900/30">
              <div className="text-[11px] text-rose-300 font-medium">🐺 Phe Ma Sói</div>
              <div className="text-xl font-bold font-mono text-rose-400 mt-0.5">{wolfCount}</div>
            </div>

            <div className="text-center p-2 rounded-xl bg-blue-950/20 border border-blue-900/30">
              <div className="text-[11px] text-blue-300 font-medium">👨 Phe Dân Làng</div>
              <div className="text-xl font-bold font-mono text-blue-400 mt-0.5">{villageCount}</div>
            </div>

            <div className="text-center p-2 rounded-xl bg-purple-950/20 border border-purple-900/30">
              <div className="text-[11px] text-purple-300 font-medium">☠️ Phe Độc Lập</div>
              <div className="text-xl font-bold font-mono text-purple-400 mt-0.5">{neutralCount}</div>
            </div>
          </div>

          {/* Validation Errors banner */}
          {errors.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-700/50 flex items-start gap-3 text-amber-300 text-xs">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1">
                {errors.map((err, idx) => (
                  <div key={idx}>• {err}</div>
                ))}
              </div>
            </div>
          )}

          {/* Cards Selection List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(ROLES_DATABASE).map((role) => {
              const currentItem = deck.find((x) => x.roleId === role.id);
              const count = currentItem ? currentItem.count : 0;
              const isSelected = selectedRoleForDetail === role.id;

              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRoleForDetail(role.id)}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                    count > 0
                      ? 'bg-zinc-900/90 border-zinc-700 shadow-md'
                      : 'bg-zinc-950/40 border-zinc-900 opacity-65 hover:opacity-100'
                  } ${isSelected ? 'ring-2 ring-cyan-500/50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <RoleCardIllustration roleId={role.id} size="sm" showDetails={false} />
                    <div className="space-y-0.5">
                      <div className="font-bold text-xs text-white flex items-center gap-1.5">
                        <span>{role.vietnameseName}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400">{role.name}</div>
                      <div className="text-[10px] text-zinc-300 font-mono">
                        Tối đa: {role.maxPerGame} thẻ
                      </div>
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-2 bg-zinc-950/80 p-1.5 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      disabled={count === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateCardCount(role.id, -1);
                      }}
                      className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-zinc-300 hover:text-white transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <span className="w-6 text-center font-mono font-bold text-sm text-white">
                      {count}
                    </span>

                    <button
                      type="button"
                      disabled={count >= role.maxPerGame}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateCardCount(role.id, 1);
                      }}
                      className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-zinc-300 hover:text-white transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            Hủy Bỏ
          </button>

          <button
            onClick={handleSave}
            disabled={!isValid}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition ${
              isValid
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-600/30'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Lưu & Áp Dụng Bộ Bài</span>
          </button>
        </div>
      </div>
    </div>
  );
};
