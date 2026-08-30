import React from 'react';
import { RoleId } from '../types';
import { ROLES_DATABASE } from '../data/rolesData';

interface Props {
  roleId: RoleId;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showDetails?: boolean;
  isRevealed?: boolean;
  className?: string;
}

export const RoleCardIllustration: React.FC<Props> = ({
  roleId,
  size = 'md',
  showDetails = true,
  className = '',
}) => {
  const role = ROLES_DATABASE[roleId] || ROLES_DATABASE.VILLAGER;

  const sizeClasses = {
    sm: 'w-24 h-36 text-[10px]',
    md: 'w-44 h-64 text-xs',
    lg: 'w-60 h-88 text-sm',
    hero: 'w-72 sm:w-80 h-[430px] text-sm',
  };

  const getTeamBadge = () => {
    switch (role.team) {
      case 'WEREWOLF':
        return { label: 'PHE SÓI', color: 'bg-rose-950/80 text-rose-300 border-rose-600/50' };
      case 'NEUTRAL':
        return { label: 'PHE ĐỘC LẬP', color: 'bg-purple-950/80 text-purple-300 border-purple-500/50' };
      default:
        return { label: 'PHE DÂN LÀNG', color: 'bg-blue-950/80 text-blue-300 border-blue-500/50' };
    }
  };

  const badge = getTeamBadge();

  // Custom Gothic SVG Illustrations for each Role
  const renderSvgArtwork = () => {
    switch (roleId) {
      case 'WEREWOLF':
      case 'ALPHA_WOLF':
      case 'WOLF_PUP':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-rose-500 drop-shadow-[0_0_12px_rgba(225,29,72,0.6)]">
            <defs>
              <radialGradient id="wolfGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#881337" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#1E070D" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="url(#wolfGlow)" />
            {/* Wolf silhouette */}
            <path
              d="M 50 15 L 62 38 L 78 30 L 72 52 L 85 62 L 68 75 L 70 90 L 50 82 L 30 90 L 32 75 L 15 62 L 28 52 L 22 30 L 38 38 Z"
              fill="#1C1917"
              stroke="#E11D48"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Glowing red eyes */}
            <ellipse cx="40" cy="52" rx="3.5" ry="5" fill="#EF4444" className="animate-pulse" />
            <ellipse cx="60" cy="52" rx="3.5" ry="5" fill="#EF4444" className="animate-pulse" />
            <circle cx="40" cy="52" r="1.5" fill="#FFF" />
            <circle cx="60" cy="52" r="1.5" fill="#FFF" />
            {/* Fangs */}
            <polygon points="44,66 47,75 50,66" fill="#FFF" />
            <polygon points="50,66 53,75 56,66" fill="#FFF" />
          </svg>
        );

      case 'SEER':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]">
            <defs>
              <radialGradient id="seerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#083344" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#040F16" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="url(#seerGlow)" />
            {/* Mystic Eye */}
            <path
              d="M 15 50 Q 50 20 85 50 Q 50 80 15 50 Z"
              fill="#0F172A"
              stroke="#06B6D4"
              strokeWidth="3"
            />
            {/* Iris & Pupils */}
            <circle cx="50" cy="50" r="15" fill="#0891B2" stroke="#22D3EE" strokeWidth="2" />
            <circle cx="50" cy="50" r="7" fill="#0E7490" />
            <circle cx="50" cy="50" r="3" fill="#FFF" className="animate-ping" />
            {/* Magic rays */}
            <line x1="50" y1="12" x2="50" y2="24" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" />
            <line x1="50" y1="76" x2="50" y2="88" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" />
            <line x1="18" y1="50" x2="28" y2="50" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" />
            <line x1="72" y1="50" x2="82" y2="50" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );

      case 'BODYGUARD':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.6)]">
            <defs>
              <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#064E3B" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#021C14" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="url(#bgGlow)" />
            {/* Great Shield */}
            <path
              d="M 50 15 L 80 25 L 75 60 C 75 75 50 90 50 90 C 50 90 25 75 25 60 L 20 25 Z"
              fill="#064E3B"
              stroke="#10B981"
              strokeWidth="3"
            />
            {/* Heraldic Cross */}
            <path d="M 50 30 L 50 72 M 35 45 L 65 45" stroke="#34D399" strokeWidth="4" strokeLinecap="round" />
          </svg>
        );

      case 'WITCH':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]">
            <defs>
              <radialGradient id="witchGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#4C1D95" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#1E073B" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="url(#witchGlow)" />
            {/* Alchemy Flask */}
            <path
              d="M 45 20 L 55 20 L 55 35 L 75 70 C 78 77 72 85 65 85 L 35 85 C 28 85 22 77 25 70 L 45 35 Z"
              fill="#2E1065"
              stroke="#A855F7"
              strokeWidth="2.5"
            />
            <ellipse cx="50" cy="65" rx="16" ry="12" fill="#7E22CE" />
            <circle cx="46" cy="62" r="3" fill="#C084FC" className="animate-bounce" />
            <circle cx="54" cy="68" r="2" fill="#E9D5FF" />
          </svg>
        );

      case 'HUNTER':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]">
            <defs>
              <radialGradient id="hunterGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#78350F" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#1C0E04" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="url(#hunterGlow)" />
            {/* Sniper Target Crosshairs */}
            <circle cx="50" cy="50" r="32" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeDasharray="6 3" />
            <circle cx="50" cy="50" r="18" fill="none" stroke="#FBBF24" strokeWidth="2" />
            <circle cx="50" cy="50" r="4" fill="#F59E0B" />
            <line x1="50" y1="10" x2="50" y2="90" stroke="#F59E0B" strokeWidth="2" />
            <line x1="10" y1="50" x2="90" y2="50" stroke="#F59E0B" strokeWidth="2" />
          </svg>
        );

      case 'JESTER':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-pink-400 drop-shadow-[0_0_12px_rgba(236,72,153,0.6)]">
            <defs>
              <radialGradient id="jesterGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#831843" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#1F0410" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="url(#jesterGlow)" />
            {/* Jester Hat */}
            <path
              d="M 25 70 C 25 50 15 35 15 25 C 25 35 40 45 50 45 C 60 45 75 35 85 25 C 85 35 75 50 75 70 Z"
              fill="#BE185D"
              stroke="#EC4899"
              strokeWidth="2.5"
            />
            {/* Bells */}
            <circle cx="15" cy="25" r="4" fill="#FBBF24" />
            <circle cx="85" cy="25" r="4" fill="#FBBF24" />
            {/* Sinister smile */}
            <path d="M 35 72 Q 50 88 65 72" fill="none" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round" />
          </svg>
        );

      case 'SERIAL_KILLER':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-violet-400 drop-shadow-[0_0_12px_rgba(139,92,246,0.6)]">
            <defs>
              <radialGradient id="skGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#3B0764" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#140224" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="url(#skGlow)" />
            {/* Dagger */}
            <path
              d="M 50 15 L 60 50 L 55 52 L 55 80 L 45 80 L 45 52 L 40 50 Z"
              fill="#581C87"
              stroke="#8B5CF6"
              strokeWidth="2.5"
            />
            <path d="M 35 50 L 65 50" stroke="#A78BFA" strokeWidth="3" />
            <circle cx="50" cy="85" r="3" fill="#A78BFA" />
          </svg>
        );

      default:
        // Villager
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-blue-400 drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]">
            <defs>
              <radialGradient id="vlgGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#172554" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#080F21" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="url(#vlgGlow)" />
            {/* Village lantern / house icon */}
            <path
              d="M 50 20 L 75 42 L 70 42 L 70 78 L 30 78 L 30 42 L 25 42 Z"
              fill="#1E3A8A"
              stroke="#3B82F6"
              strokeWidth="2.5"
            />
            {/* Glowing window */}
            <rect x="42" y="52" width="16" height="16" rx="2" fill="#F59E0B" />
            <line x1="50" y1="52" x2="50" y2="68" stroke="#78350F" strokeWidth="1.5" />
            <line x1="42" y1="60" x2="58" y2="60" stroke="#78350F" strokeWidth="1.5" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative rounded-3xl overflow-hidden border bg-gradient-to-b from-[#141724] to-[#090B12] shadow-2xl flex flex-col justify-between p-3 select-none transition-all duration-300 ${role.colorScheme.border} ${sizeClasses[size]} ${className}`}
    >
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 blur-xl"
        style={{ backgroundColor: role.colorScheme.primary }}
      />

      {/* Top Card Header */}
      <div className="relative z-10 flex items-center justify-between w-full">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
          {badge.label}
        </span>
        <span className="font-mono text-[10px] text-zinc-400">#N{role.nightPriority}</span>
      </div>

      {/* Center Artwork Frame */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-2">
        <div className="w-full h-full max-h-[160px] flex items-center justify-center">
          {renderSvgArtwork()}
        </div>
      </div>

      {/* Bottom Information */}
      <div className="relative z-10 text-center space-y-1">
        <h4 className="font-serif font-black tracking-wider uppercase text-white drop-shadow-md">
          {role.vietnameseName}
        </h4>
        <p className="text-[10px] text-zinc-400 font-mono">{role.name}</p>

        {showDetails && size !== 'sm' && (
          <div className="mt-1 pt-1.5 border-t border-white/10 text-left">
            <p className="text-[11px] text-zinc-300 leading-tight line-clamp-2">
              {role.shortAbility}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
