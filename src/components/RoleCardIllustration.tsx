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

const CARD_IMAGES: Record<RoleId, string> = {
  VILLAGER: '/cards/villager.png',
  SEER: '/cards/seer.png',
  BODYGUARD: '/cards/bodyguard.png',
  WITCH: '/cards/witch.png',
  HUNTER: '/cards/hunter.png',
  ELDER: '/cards/elder.png',
  MAYOR: '/cards/mayor.png',
  LIEU: '/cards/lieu.png',
  CUPID: '/cards/cupid.png',
  WEREWOLF: '/cards/werewolf.png',
  WOLF_PUP: '/cards/wolf_pup.png',
  ALPHA_WOLF: '/cards/alpha_wolf.png',
  JESTER: '/cards/jester.png',
  SERIAL_KILLER: '/cards/serial_killer.png',
  TRAITOR: '/cards/traitor.png',
};

const CARD_BACK = '/cards/back.png';

export const RoleCardIllustration: React.FC<Props> = ({
  roleId,
  size = 'md',
  showDetails = true,
  isRevealed = true,
  className = '',
}) => {
  const role = ROLES_DATABASE[roleId] || ROLES_DATABASE.VILLAGER;

  const sizeClasses = {
    sm: 'w-24 h-36',
    md: 'w-44 h-64',
    lg: 'w-60 h-[330px]',
    hero: 'w-72 sm:w-80 h-[430px]',
  };

  const imageSrc = isRevealed ? CARD_IMAGES[role.id] : CARD_BACK;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl select-none transition-all duration-300 ${sizeClasses[size]} ${className}`}
      title={isRevealed ? role.vietnameseName : 'Mặt sau thẻ bài'}
    >
      <img
        src={imageSrc}
        alt={isRevealed ? role.vietnameseName : 'Mặt sau thẻ bài'}
        className="block w-full h-full object-cover"
        draggable={false}
      />

      {showDetails && isRevealed && size !== 'sm' && (
        <div className="absolute left-2 right-2 bottom-2 rounded-xl bg-black/65 backdrop-blur-sm border border-white/10 px-2.5 py-2">
          <p className="text-[10px] sm:text-xs text-white/90 text-center leading-tight">
            {role.shortAbility}
          </p>
        </div>
      )}
    </div>
  );
};
