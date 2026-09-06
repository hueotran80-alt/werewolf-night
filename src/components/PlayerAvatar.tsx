import React from 'react';
import { Player } from '../types';

interface Props {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
  speaking?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizes = {
  sm: 'w-8 h-8 text-xs rounded-xl',
  md: 'w-11 h-11 text-sm rounded-2xl',
  lg: 'w-24 h-24 text-2xl rounded-3xl',
};

export const PlayerAvatar: React.FC<Props> = ({
  player,
  size = 'md',
  online,
  speaking,
  onClick,
  className = '',
}) => {
  const body = (
    <div
      className={`relative ${sizes[size]} overflow-visible flex-shrink-0 ${className}`}
    >
      <div className={`w-full h-full overflow-hidden ${sizes[size]} bg-gradient-to-tr from-zinc-800 to-zinc-700 border border-zinc-600 flex items-center justify-center font-bold text-white`}>
        {player.avatarUrl ? (
          <img
            src={player.avatarUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          player.nickname.charAt(0).toUpperCase()
        )}
      </div>

      {typeof online === 'boolean' && (
        <span
          className={`absolute right-0 bottom-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${
            online ? 'bg-emerald-400' : 'bg-rose-500'
          }`}
          title={online ? 'Online' : 'Offline'}
        />
      )}

      {speaking && (
        <span className="absolute -inset-1 rounded-[inherit] border border-emerald-400 animate-ping opacity-50 pointer-events-none" />
      )}
    </div>
  );

  if (!onClick) return body;

  return (
    <button
      type="button"
      onClick={onClick}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-[inherit]"
    >
      {body}
    </button>
  );
};
