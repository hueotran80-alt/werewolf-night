import React, { useState } from 'react';
import { RoleId, TeamType } from '../types';
import { ROLES_DATABASE } from '../data/rolesData';
import { RoleCardIllustration } from './RoleCardIllustration';
import { X, Search, Shield, Moon, Award, BookOpen, Layers } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CardLibraryModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [selectedTeam, setSelectedTeam] = useState<TeamType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoleId, setActiveRoleId] = useState<RoleId>('WEREWOLF');

  if (!isOpen) return null;

  const allRoles = Object.values(ROLES_DATABASE);

  const filteredRoles = allRoles.filter((r) => {
    const matchesTeam = selectedTeam === 'ALL' || r.team === selectedTeam;
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.vietnameseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.shortAbility.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTeam && matchesSearch;
  });

  const activeRole = ROLES_DATABASE[activeRoleId] || allRoles[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl h-[88vh] bg-[#0B0F19] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white font-serif tracking-wide">
                THƯ VIỆN THẺ BÀI & VAI TRÒ
              </h3>
              <p className="text-xs text-zinc-400">
                Bách khoa toàn thư 13 vai trò độc quyền trong Werewolf: Night of Deception
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/40 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900/80 rounded-2xl border border-zinc-800 w-full sm:w-auto">
            <button
              onClick={() => setSelectedTeam('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedTeam === 'ALL' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Tất Cả ({allRoles.length})
            </button>
            <button
              onClick={() => setSelectedTeam('WEREWOLF')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedTeam === 'WEREWOLF'
                  ? 'bg-rose-900/60 text-rose-300 border border-rose-700/50'
                  : 'text-zinc-400 hover:text-rose-300'
              }`}
            >
              🐺 Phe Sói
            </button>
            <button
              onClick={() => setSelectedTeam('VILLAGE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedTeam === 'VILLAGE'
                  ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                  : 'text-zinc-400 hover:text-blue-300'
              }`}
            >
              👨 Phe Dân
            </button>
            <button
              onClick={() => setSelectedTeam('NEUTRAL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedTeam === 'NEUTRAL'
                  ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
                  : 'text-zinc-400 hover:text-purple-300'
              }`}
            >
              ☠️ Phe Độc Lập
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Tìm kiếm vai trò..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition"
            />
          </div>
        </div>

        {/* Content Split: Left Role List / Right Role Focus Detail */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Left: Role List (5 Cols) */}
          <div className="md:col-span-5 border-r border-zinc-800 overflow-y-auto p-4 space-y-2">
            {filteredRoles.map((role) => {
              const isSelected = activeRoleId === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setActiveRoleId(role.id)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    isSelected
                      ? 'bg-zinc-800/90 border-cyan-500/60 shadow-lg shadow-cyan-950/40 translate-x-1'
                      : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  <RoleCardIllustration roleId={role.id} size="sm" showDetails={false} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white truncate font-serif">
                        {role.vietnameseName}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        Ưu tiên #{role.nightPriority}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">{role.shortAbility}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Selected Role Deep Dive (7 Cols) */}
          <div className="md:col-span-7 overflow-y-auto p-6 flex flex-col items-center justify-start space-y-6 bg-zinc-950/40">
            {activeRole && (
              <>
                <RoleCardIllustration roleId={activeRole.id} size="hero" showDetails={false} />

                <div className="w-full space-y-4">
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      <span>Cơ chế & Kỹ năng chi tiết:</span>
                    </div>
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      {activeRole.fullDescription}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/30 space-y-2">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      <span>Mục tiêu & Điều kiện chiến thắng:</span>
                    </div>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      {activeRole.winCondition}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
