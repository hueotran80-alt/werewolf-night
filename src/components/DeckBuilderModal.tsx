import React, { useState, useEffect } from 'react';
import { DeckCardConfig, RoleId, RoomSettings } from '../types';
import { ROLES_DATABASE, DECK_PRESETS, MODE_PLAYER_RANGE } from '../data/rolesData';
import { RoleCardIllustration } from './RoleCardIllustration';
import { X, Plus, Minus, Check, AlertTriangle, Sparkles, RefreshCw, Users, Skull } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentDeck: DeckCardConfig[];
  playerCount: number;
  settings: RoomSettings;
  onSaveDeck: (newDeck: DeckCardConfig[]) => void;
  onUpdateSettings: (newSettings: Partial<RoomSettings>) => void;
}

export const DeckBuilderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentDeck,
  playerCount,
  settings,
  onSaveDeck,
  onUpdateSettings,
}) => {
  const [deck, setDeck] = useState<DeckCardConfig[]>(currentDeck);
  // Chế độ đang được chỉnh sửa trong modal này. Khởi tạo từ settings hiện tại
  // của phòng, nhưng chỉ thực sự áp dụng (gửi lên server) khi bấm "Lưu & Áp Dụng".
  const [mode, setMode] = useState<RoomSettings['mode']>(settings.mode);
  const [selectedRoleForDetail, setSelectedRoleForDetail] = useState<RoleId>('WEREWOLF');

  useEffect(() => {
    setDeck(currentDeck);
    setMode(settings.mode);
  }, [currentDeck, settings.mode, isOpen]);

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

  // Chế độ nào hợp lệ với số người chơi hiện tại của phòng.
  // - 2 Phe: 6-10 người, không có vai Phe Độc Lập.
  // - 3 Phe: 9-15 người, được có vai Phe Độc Lập.
  // Với phòng 9-10 người, cả 2 chế độ đều khả dụng để Quản Trò lựa chọn.
  const isModeAllowedForPlayerCount = (m: RoomSettings['mode']) => {
    const range = MODE_PLAYER_RANGE[m];
    return playerCount >= range.min && playerCount <= range.max;
  };
  const twoTeamAllowed = isModeAllowedForPlayerCount('TWO_TEAM');
  const threeTeamAllowed = isModeAllowedForPlayerCount('THREE_TEAM');

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

  const activeRange = MODE_PLAYER_RANGE[mode];
  if (playerCount < activeRange.min || playerCount > activeRange.max) {
    errors.push(
      `Chế độ ${mode === 'TWO_TEAM' ? '2 Phe' : '3 Phe'} chỉ hỗ trợ từ ${activeRange.min} đến ${activeRange.max} người chơi (phòng hiện có ${playerCount} người).`
    );
  }
  if (mode === 'TWO_TEAM' && neutralCount > 0) {
    errors.push('Chế độ 2 Phe không cho phép có thẻ bài Phe Độc Lập.');
  }

  const isValid = errors.length === 0;

  // Chuyển chế độ 2 Phe / 3 Phe. Khi chuyển sang 2 Phe, tự động bỏ toàn bộ
  // thẻ bài thuộc Phe Độc Lập ra khỏi bộ bài đang chỉnh, vì chế độ này
  // không cho phép chọn nhân vật phe thứ 3.
  const handleSelectMode = (newMode: RoomSettings['mode']) => {
    if (!isModeAllowedForPlayerCount(newMode)) return;
    setMode(newMode);
    if (newMode === 'TWO_TEAM') {
      setDeck((prev) => prev.filter((item) => ROLES_DATABASE[item.roleId]?.team !== 'NEUTRAL'));
    }
  };

  const updateCardCount = (roleId: RoleId, delta: number) => {
    const roleDef = ROLES_DATABASE[roleId];
    if (!roleDef) return;
    // Chế độ 2 Phe: không cho phép chọn bất kỳ vai trò nào thuộc Phe Độc Lập.
    if (mode === 'TWO_TEAM' && roleDef.team === 'NEUTRAL' && delta > 0) return;

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

  // Scale a preset deck so its total matches the room's current player count:
  // only the plain VILLAGER count grows/shrinks, special roles stay as defined
  // by the preset. This lets a "6-8 người" preset actually be used with 6, 7, or 8.
  // Đồng thời áp dụng luôn chế độ (2 Phe / 3 Phe) đi kèm với bộ bài mẫu, để
  // tránh tình trạng chọn bộ bài 3 Phe nhưng phòng vẫn đang ở chế độ 2 Phe
  // (gây lỗi validate "Chế độ 2 Phe không cho phép Phe Độc Lập" dù đã chọn đúng mẫu).
  const applyPreset = (presetDeck: DeckCardConfig[], presetMode: RoomSettings['mode']) => {
    const specialRoles = presetDeck.filter((d) => d.roleId !== 'VILLAGER');
    const fixedTotal = specialRoles.reduce((sum, d) => sum + d.count, 0);
    const villagerCount = playerCount - fixedTotal;

    setMode(presetMode);

    if (villagerCount < 0) {
      // Not enough players even with 0 Villagers left — apply as-is and let
      // the validation banner explain why it doesn't fit.
      setDeck(presetDeck);
      return;
    }

    const scaled: DeckCardConfig[] = specialRoles.map((d) => ({ ...d }));
    if (villagerCount > 0) {
      scaled.push({ roleId: 'VILLAGER', count: villagerCount });
    }
    setDeck(scaled);
  };

  const handleSave = () => {
    if (isValid) {
      if (mode !== settings.mode) {
        onUpdateSettings({ mode });
      }
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
          {/* Mode Selector: 2 Phe (6-10 người) vs 3 Phe (9-15 người) */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Chọn số phe cho bộ bài:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectMode('TWO_TEAM')}
                disabled={!twoTeamAllowed}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                  mode === 'TWO_TEAM'
                    ? 'bg-cyan-950/40 border-cyan-500/60 ring-2 ring-cyan-500/30'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                } ${!twoTeamAllowed ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-xs font-bold text-white">2 Phe (Dân vs Sói)</div>
                  <div className="text-[10px] text-zinc-400">
                    {MODE_PLAYER_RANGE.TWO_TEAM.min}-{MODE_PLAYER_RANGE.TWO_TEAM.max} người • Không có Phe Độc Lập
                  </div>
                  {!twoTeamAllowed && (
                    <div className="text-[10px] text-rose-400 mt-0.5">
                      Cần {MODE_PLAYER_RANGE.TWO_TEAM.min}-{MODE_PLAYER_RANGE.TWO_TEAM.max} người chơi
                    </div>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMode('THREE_TEAM')}
                disabled={!threeTeamAllowed}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                  mode === 'THREE_TEAM'
                    ? 'bg-purple-950/40 border-purple-500/60 ring-2 ring-purple-500/30'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                } ${!threeTeamAllowed ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  <Skull className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-xs font-bold text-white">3 Phe (Có Độc Lập)</div>
                  <div className="text-[10px] text-zinc-400">
                    {MODE_PLAYER_RANGE.THREE_TEAM.min}-{MODE_PLAYER_RANGE.THREE_TEAM.max} người • Được chọn Phe Độc Lập
                  </div>
                  {!threeTeamAllowed && (
                    <div className="text-[10px] text-rose-400 mt-0.5">
                      Cần {MODE_PLAYER_RANGE.THREE_TEAM.min}-{MODE_PLAYER_RANGE.THREE_TEAM.max} người chơi
                    </div>
                  )}
                </div>
              </button>
            </div>
            {twoTeamAllowed && threeTeamAllowed && (
              <div className="text-[10px] text-zinc-400 italic">
                Phòng {playerCount} người: có thể chọn cả 2 Phe hoặc 3 Phe.
              </div>
            )}
          </div>

          {/* Quick Presets Bar */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Bộ bài mẫu gợi ý:
            </div>
            <div className="flex flex-wrap gap-2">
              {DECK_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.deck, p.mode)}
                  disabled={!isModeAllowedForPlayerCount(p.mode)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white border border-zinc-700/60 flex items-center gap-1.5 transition"
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
              // Chế độ 2 Phe không cho phép chọn bất kỳ nhân vật nào thuộc Phe Độc Lập.
              const isLockedByMode = mode === 'TWO_TEAM' && role.team === 'NEUTRAL';

              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRoleForDetail(role.id)}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                    isLockedByMode
                      ? 'bg-zinc-950/20 border-zinc-900 opacity-35 grayscale cursor-not-allowed'
                      : count > 0
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
                        {isLockedByMode ? 'Khóa ở chế độ 2 Phe' : `Tối đa: ${role.maxPerGame} thẻ`}
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
                      disabled={isLockedByMode || count >= role.maxPerGame}
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