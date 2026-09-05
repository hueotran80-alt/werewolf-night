// ============================================================================
// WEREWOLF: NIGHT OF DECEPTION - Shared TypeScript Types
// ============================================================================

export type Team = 'VILLAGE' | 'WEREWOLF' | 'NEUTRAL';
export type TeamType = Team;

// Loại bot: giữ Bot Test cũ và tách riêng Bot thông minh để có thể mở rộng sau này.
export type BotType = 'LEGACY' | 'GEMINI';
export type SmartBotProfileId = 'LINH';

export type RoleId =
  | 'VILLAGER'
  | 'SEER'
  | 'BODYGUARD'
  | 'WITCH'
  | 'HUNTER'
  | 'ELDER'
  | 'MAYOR'
  | 'LIEU'
  | 'WEREWOLF'
  | 'WOLF_PUP'
  | 'ALPHA_WOLF'
  | 'JESTER'
  | 'SERIAL_KILLER'
  | 'TRAITOR'
  | 'CUPID';

export type GamePhase =
  | 'LOBBY'
  | 'STARTING'
  | 'ROLE_REVEAL'
  | 'NIGHT'
  | 'DAY_ANNOUNCEMENT'
  | 'DAY_DISCUSSION'
  | 'VOTING'
  | 'DEATH_REBUTTAL'
  | 'VOTE_RESOLUTION'
  | 'HUNTER_REVENGE'
  | 'GAME_OVER';

export type NightStep =
  | 'CUPID_PAIR'
  | 'WEREWOLF_HUNT'
  | 'SERIAL_KILLER_HUNT'
  | 'WITCH_HEAL'
  | 'WITCH_POISON'
  | 'OTHER_ROLES'
  | 'SEER_INVESTIGATE'
  | 'BODYGUARD_PROTECT'
  | 'LIEU_SILENCE'
  | 'HUNTER_SHOT'
  | 'NONE';

export interface RoleDefinition {
  id: RoleId;
  name: string;
  vietnameseName: string;
  team: Team;
  nightPriority: number; // Lower = acts earlier in the night
  description: string;
  fullDescription: string;
  objective: string;
  shortAbility: string;
  whenActive: string;
  usageLimit: string;
  maxPerGame: number;
  winCondition: string;
  colorScheme: {
    primary: string;
    bgGlow: string;
    border: string;
    badge: string;
  };
  iconName: string;
}

export interface Player {
  id: string;
  nickname: string;
  avatarSeed: string;
  isHost: boolean;
  isAlive: boolean;
  isReady: boolean;
  role?: RoleId;
  deathReason?: string;
  deathRound?: number;
  deathPhase?: 'NIGHT' | 'DAY' | 'HUNTER';
  protectedCount?: number;
  potionSaved?: boolean;
  isBot?: boolean;
  botType?: BotType;
  botProfileId?: SmartBotProfileId;
  socketConnected: boolean;
  lastActive: number;
  isSilenced?: boolean;
  silencedUntilRound?: number;
}

export interface DeckCardConfig {
  roleId: RoleId;
  count: number;
}

export interface DeckPreset {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  mode: 'TWO_TEAM' | 'THREE_TEAM';
  deck: DeckCardConfig[];
}

export interface RoomSettings {
  mode: 'TWO_TEAM' | 'THREE_TEAM';
  maxPlayers: number;
  discussionTimeSeconds: number;
  votingTimeSeconds: number;
  tieHandling: 'NO_ELIMINATION' | 'REVOTE' | 'MAYOR_DECIDES';
  allowSelfProtectConsecutive: boolean;
  revealRoleOnDeath: boolean;
  witchCanSelfHealFirstNightOnly: boolean;
}

export interface GameAction {
  actionType:
    | 'CUPID_PAIR'
    | 'WOLF_KILL'
    | 'WOLF_CONFIRM'
    | 'SEER_CHECK'
    | 'BODYGUARD_GUARD'
    | 'WITCH_HEAL'
    | 'WITCH_POISON'
    | 'WITCH_SKIP'
    | 'WITCH_DECLINE_HEAL'
    | 'WITCH_DECLINE_POISON'
    | 'SERIAL_KILL_SKIP'
    | 'SERIAL_KILL'
    | 'LIEU_SILENCE'
    | 'HUNTER_KILL'
    | 'VOTE';
  actorPlayerId?: string;
  targetPlayerId?: string;
  extraData?: any;
}

export interface NightState {
  currentStep: NightStep;
  stepTimeRemaining: number;
  stepStartedAt?: number;

  // Cupid / lovers
  cupidPlayerId?: string;
  loverPair?: [string, string];

  // Werewolves
  werewolfProposalTarget?: string;
  werewolfVotes: Record<string, string>; // legacy + per-target decisions
  werewolfConfirmations: Record<string, boolean>;
  werewolfKillTargets: string[];
  werewolfKillIndex: number;
  werewolfMaxKills: number;
  werewolfTarget?: string;

  // Witch receives only a victim identity (never the victim role)
  witchVictimId?: string;
  witchVictimName?: string;
  witchVictimIds?: string[];
  witchVictimNames?: string[];

  seerTarget?: string;
  seerResult?: {
    targetId: string;
    targetName: string;
    isWerewolf: boolean;
    roleNameRevealed?: string;
  };
  bodyguardTarget?: string;
  lastGuardedPlayerId?: string;
  witchSaved: boolean;
  witchPoisonTarget?: string;
  witchHasHeal: boolean;
  witchHasPoison: boolean;
  serialKillerTarget?: string;
  serialKillerConfirmed?: boolean;
  lieuTarget?: string;
  hunterTarget?: string;
  nightVictims: string[];
}

export interface VotingState {
  votes: Record<string, string>; // voterId -> targetPlayerId
  voteCounts: Record<string, number>; // targetPlayerId -> count
  timeRemaining: number;
  isLocked: boolean;
  eliminatedPlayerId?: string;
  isTie: boolean;
}

export interface GameEventLog {
  id: string;
  round: number;
  phase: GamePhase;
  timestamp: number;
  message: string;
  type: 'INFO' | 'DEATH' | 'VOTE' | 'NIGHT_ACTION' | 'VICTORY' | 'WARNING';
  isPublic: boolean;
  targetPlayerId?: string;
}

export interface HostTransferRequest {
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  toPlayerName: string;
  expiresAt: number; // 30s countdown
}

export interface VoiceUserState {
  playerId: string;
  nickname: string;
  isMuted: boolean;
  isSpeaking: boolean;
  isDeafened: boolean;
  isSilenced?: boolean;
}

export interface GameState {
  roomId: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'FINISHED';
  currentPhase: GamePhase;
  roundNumber: number;
  phaseEndsAt: number;
  phaseDuration: number;
  winnerTeam?: Team | 'JESTER' | 'SERIAL_KILLER' | 'DRAW';
  winnerMessage?: string;
  deck: DeckCardConfig[];
  nightState?: NightState;
  votingState?: VotingState;
  deathRebuttalPlayerIds: string[];
  lastNightVictims: {
    playerId: string;
    playerName: string;
    roleName?: string;
    reason: string;
  }[];
  lastDayEliminated?: {
    playerId: string;
    playerName: string;
    roleName?: string;
    votesReceived: number;
  };
  hunterMustShootPlayerId?: string;
  logs: GameEventLog[];
}

export interface RoomData {
  id: string;
  code: string;
  hostPlayerId: string;
  players: Player[];
  status?: 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED';
  settings: RoomSettings;
  deck: DeckCardConfig[];
  gameState?: GameState;
  createdAt: number;
  isLocked: boolean;
  hostTransferRequest?: HostTransferRequest;
  voiceStates?: Record<string, VoiceUserState>;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  avatarSeed: string;
  text: string;
  timestamp: number;
  channel: 'LOBBY' | 'DAY_PUBLIC' | 'GHOST_PRIVATE' | 'WOLF_PRIVATE';
  isSystem?: boolean;
}

// WebSocket Protocol Interfaces
export type WsMessageType =
  | 'AUTH'
  | 'AUTH_SUCCESS'
  | 'ROOM_STATE'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'HOST_CHANGED'
  | 'HOST_TRANSFER_REQUEST'
  | 'HOST_TRANSFER_RESPOND'
  | 'DECK_UPDATED'
  | 'SETTINGS_UPDATED'
  | 'GAME_START_REQUEST'
  | 'GAME_STARTED'
  | 'ROLE_ASSIGNED'
  | 'PHASE_CHANGED'
  | 'ACTION_SUBMIT'
  | 'ACTION_RESULT'
  | 'VOTE_SUBMIT'
  | 'VOTE_UPDATED'
  | 'CHAT_MESSAGE'
  | 'NEW_CHAT'
  | 'RECONNECT_REQUEST'
  | 'RECONNECT_STATE'
  | 'RETURN_TO_LOBBY'
  | 'REPLAY_REQUEST'
  | 'ERROR'
  | 'ADD_BOT_REQUEST'
  | 'ADD_SMART_BOT_REQUEST'
  | 'KICK_PLAYER_REQUEST'
  | 'VOICE_STATUS_UPDATE'
  | 'VOICE_SIGNAL'
  | 'VOICE_FORCE_MUTE_ALL';

export interface WsMessagePayload {
  type: WsMessageType;
  roomId?: string;
  playerId?: string;
  sessionToken?: string;
  payload?: any;
}