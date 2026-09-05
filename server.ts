import 'dotenv/config';
import express, { Request, Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import {
  RoomData,
  Player,
  GameState,
  GamePhase,
  RoleId,
  DeckCardConfig,
  RoomSettings,
  NightState,
  VotingState,
  GameAction,
  ChatMessage,
  WsMessagePayload,
  HostTransferRequest,
} from './src/types';
import { ROLES_DATABASE, DECK_PRESETS, MODE_PLAYER_RANGE } from './src/data/rolesData';
import {
  maybeBotReplyToChat,
  chooseBotNightAction,
  chooseBotVote,
  MAX_SMART_BOTS_PER_ROOM,
} from './src/services/aiBotService';

// Hầu hết nền tảng cloud (Render, Railway, Fly.io, Heroku...) tự cấp một
// biến môi trường PORT và yêu cầu server lắng nghe đúng cổng đó. Nếu không
// có (chạy máy cá nhân), mặc định dùng cổng 3000 như trước.
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

// In-Memory Storage
const rooms: Map<string, RoomData> = new Map();
const playerSockets: Map<string, Set<WebSocket>> = new Map(); // playerId -> WebSockets
const socketPlayerMap: Map<WebSocket, { playerId: string; roomId: string }> = new Map();
const roomChatMap: Map<string, ChatMessage[]> = new Map(); // roomId -> ChatMessage[]

// Default Room Settings
const DEFAULT_SETTINGS: RoomSettings = {
  mode: 'TWO_TEAM',
  maxPlayers: 15,
  discussionTimeSeconds: 60,
  votingTimeSeconds: 30,
  tieHandling: 'NO_ELIMINATION',
  allowSelfProtectConsecutive: false,
  revealRoleOnDeath: true,
  witchCanSelfHealFirstNightOnly: true,
};

// Generate random 4-6 char Room Code e.g. WOLF-7K29
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part = '';
  for (let i = 0; i < 4; i++) {
    part += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `WOLF-${part}`;
}

// Helper to filter sensitive data per player
function getSanitizedRoomForPlayer(room: RoomData, playerId: string): RoomData {
  const player = room.players.find((p) => p.id === playerId);
  const isGameOver = room.gameState?.currentPhase === 'GAME_OVER';

  // Never send the authoritative night decisions to everybody. Only the
  // actor(s) who need a field receive it.
  const sanitizedPlayers: Player[] = room.players.map((p) => {
    let roleToReveal: RoleId | undefined = undefined;

    if (isGameOver) {
      roleToReveal = p.role;
    } else if (p.id === playerId) {
      roleToReveal = p.role;
    } else if (!p.isAlive && room.settings.revealRoleOnDeath) {
      roleToReveal = p.role;
    } else if (
      player?.role &&
      ROLES_DATABASE[player.role]?.team === 'WEREWOLF' &&
      p.role &&
      ROLES_DATABASE[p.role]?.team === 'WEREWOLF'
    ) {
      roleToReveal = p.role;
    }

    return { ...p, role: roleToReveal };
  });

  const gs = room.gameState;
  let sanitizedGameState: GameState | undefined = undefined;

  if (gs) {
    const ns = gs.nightState;
    let safeNightState: any = undefined;

    if (ns) {
      safeNightState = {
        currentStep: ns.currentStep,
        stepTimeRemaining: ns.stepTimeRemaining,
        stepStartedAt: ns.stepStartedAt,
        nightVictims: ns.nightVictims,
        witchHasHeal: false,
        witchHasPoison: false,
        witchSaved: false,
        werewolfVotes: {},
        werewolfConfirmations: {},
        werewolfKillTargets: [],
        werewolfKillIndex: ns.werewolfKillIndex,
        werewolfMaxKills: ns.werewolfMaxKills,
      };

      // Cupid + both lovers are the only three people who receive pair info.
      const pair: string[] = ns.loverPair ? [...ns.loverPair] : [];
      if (
        playerId === ns.cupidPlayerId ||
        pair.includes(playerId)
      ) {
        safeNightState.loverPair = pair;
        safeNightState.cupidPlayerId = ns.cupidPlayerId;
      }

      // Wolves can see the current proposal and confirmation state, but no
      // non-wolf can see it.
      if (
        player?.role &&
        ROLES_DATABASE[player.role]?.team === 'WEREWOLF'
      ) {
        safeNightState.werewolfProposalTarget = ns.werewolfProposalTarget;
        safeNightState.werewolfTarget = ns.werewolfTarget;
        safeNightState.werewolfVotes = ns.werewolfVotes;
        safeNightState.werewolfConfirmations = ns.werewolfConfirmations;
        safeNightState.werewolfKillTargets = ns.werewolfKillTargets;
      }

      if (player?.role === 'WITCH') {
        safeNightState.witchHasHeal = ns.witchHasHeal;
        safeNightState.witchHasPoison = ns.witchHasPoison;
        safeNightState.witchSaved = ns.witchSaved;
        safeNightState.witchVictimId = ns.witchVictimId;
        safeNightState.witchVictimName = ns.witchVictimName;
        safeNightState.witchVictimIds = ns.witchVictimIds;
        safeNightState.witchVictimNames = ns.witchVictimNames;
        safeNightState.witchPoisonTarget = ns.witchPoisonTarget;
      }

      if (player?.role === 'SEER') {
        safeNightState.seerTarget = ns.seerTarget;
        safeNightState.seerResult = ns.seerResult;
      }

      if (player?.role === 'BODYGUARD') {
        safeNightState.bodyguardTarget = ns.bodyguardTarget;
        safeNightState.lastGuardedPlayerId = ns.lastGuardedPlayerId;
      }

      if (player?.role === 'SERIAL_KILLER') {
        safeNightState.serialKillerTarget = ns.serialKillerTarget;
        safeNightState.serialKillerConfirmed = ns.serialKillerConfirmed;
      }

      if (player?.role === 'LIEU') {
        safeNightState.lieuTarget = ns.lieuTarget;
      }
    }

    sanitizedGameState = {
      ...gs,
      // The complete game journal contains secret night actions. It is sent to
      // clients only after the game has ended, when VictoryScreen is shown.
      logs: gs.logs.filter((log) => isGameOver || log.isPublic),
      nightState: safeNightState,
    };
  }

  return {
    ...room,
    players: sanitizedPlayers,
    gameState: sanitizedGameState,
  };
}

// Broadcast room state to all players in a room with appropriate sanitization
function broadcastRoom(roomId: string, messageType: string = 'ROOM_STATE', extraPayload: any = {}) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.players.forEach((p) => {
    const sockets = playerSockets.get(p.id);
    if (sockets && sockets.size > 0) {
      const sanitizedRoom = getSanitizedRoomForPlayer(room, p.id);
      const payload: WsMessagePayload = {
        type: messageType as any,
        roomId: room.id,
        playerId: p.id,
        payload: {
          room: sanitizedRoom,
          ...extraPayload,
        },
      };
      const jsonStr = JSON.stringify(payload);
      sockets.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(jsonStr);
        }
      });
    }
  });
}

function sendToPlayer(playerId: string, messageType: string, payload: any) {
  const sockets = playerSockets.get(playerId);
  if (sockets) {
    const msg = JSON.stringify({ type: messageType, payload });
    sockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
}

// ----------------------------------------------------------------------------
// GAME LOGIC & STATE MACHINE
// ----------------------------------------------------------------------------

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Scale a preset deck so its total card count exactly matches the room's
// current player count. Only the plain VILLAGER count is grown/shrunk;
// all special role counts from the preset are kept as-is. This is what lets
// a preset advertised as "6-8 người" actually be played with 6, 7 OR 8 people.
function scaleDeckToPlayerCount(presetDeck: DeckCardConfig[], playerCount: number): DeckCardConfig[] {
  const specialRoles = presetDeck.filter((d) => d.roleId !== 'VILLAGER');
  const fixedTotal = specialRoles.reduce((sum, d) => sum + d.count, 0);
  const villagerCount = playerCount - fixedTotal;

  if (villagerCount < 0) {
    // Player count is too low even with zero Villagers left (should not
    // happen if DECK_PRESETS.minPlayers is configured correctly) — fall back
    // to the raw preset and let validateDeck() surface a clear error.
    return presetDeck;
  }

  const scaled: DeckCardConfig[] = specialRoles.map((d) => ({ ...d }));
  if (villagerCount > 0) {
    scaled.push({ roleId: 'VILLAGER', count: villagerCount });
  }
  return scaled;
}

// Pick the best matching preset for the current player count and scale it
// (see scaleDeckToPlayerCount) so the deck is always immediately playable.
function getAutoDeckForPlayerCount(playerCount: number): DeckCardConfig[] | null {
  const preset = DECK_PRESETS.find((p) => p.minPlayers <= playerCount && p.maxPlayers >= playerCount);
  if (!preset) return null;
  return scaleDeckToPlayerCount(preset.deck, playerCount);
}

// Validate Deck configuration
function validateDeck(deck: DeckCardConfig[], playerCount: number, mode: 'TWO_TEAM' | 'THREE_TEAM'): { valid: boolean; error?: string } {
  const totalCards = deck.reduce((sum, d) => sum + d.count, 0);
  if (totalCards !== playerCount) {
    return { valid: false, error: `Số lượng thẻ bài (${totalCards}) phải bằng chính xác số người chơi (${playerCount}).` };
  }

  let wolfCount = 0;
  let villageCount = 0;
  let neutralCount = 0;

  deck.forEach((d) => {
    const def = ROLES_DATABASE[d.roleId];
    if (def.team === 'WEREWOLF') wolfCount += d.count;
    if (def.team === 'VILLAGE') villageCount += d.count;
    if (def.team === 'NEUTRAL') neutralCount += d.count;
  });

  if (wolfCount === 0) {
    return { valid: false, error: 'Bộ bài bắt buộc phải có ít nhất một vai trò thuộc Phe Ma Sói.' };
  }
  if (villageCount === 0) {
    return { valid: false, error: 'Bộ bài bắt buộc phải có ít nhất một vai trò thuộc Phe Dân Làng.' };
  }
  if (wolfCount >= villageCount + neutralCount) {
    return { valid: false, error: 'Số lượng Ma Sói ban đầu phải nhỏ hơn tổng số dân và phe trung lập.' };
  }
  const range = MODE_PLAYER_RANGE[mode];
  if (playerCount < range.min || playerCount > range.max) {
    const modeLabel = mode === 'TWO_TEAM' ? '2 Phe (Dân vs Sói)' : '3 Phe (Có Độc Lập)';
    return {
      valid: false,
      error: `Chế độ ${modeLabel} chỉ hỗ trợ từ ${range.min} đến ${range.max} người chơi (hiện tại: ${playerCount} người).`,
    };
  }
  if (mode === 'TWO_TEAM' && neutralCount > 0) {
    return { valid: false, error: 'Chế độ 2 Phe không được chứa các vai trò thuộc Phe Độc Lập (Kẻ Hề, Kẻ Sát Nhân...).' };
  }

  return { valid: true };
}

// Check Victory Conditions
function checkVictory(room: RoomData): { gameOver: boolean; winner?: 'VILLAGE' | 'WEREWOLF' | 'NEUTRAL' | 'JESTER' | 'SERIAL_KILLER'; message?: string } {
  const alivePlayers = room.players.filter((p) => p.isAlive);
  const aliveWolves = alivePlayers.filter((p) => p.role && ROLES_DATABASE[p.role]?.team === 'WEREWOLF');
  const aliveVillagers = alivePlayers.filter((p) => p.role && ROLES_DATABASE[p.role]?.team === 'VILLAGE');
  const aliveNeutrals = alivePlayers.filter((p) => p.role && ROLES_DATABASE[p.role]?.team === 'NEUTRAL');
  const aliveSerialKiller = alivePlayers.find((p) => p.role === 'SERIAL_KILLER');

  // 1. Serial Killer Victory
  if (aliveSerialKiller && alivePlayers.length <= 2 && aliveWolves.length === 0) {
    return {
      gameOver: true,
      winner: 'SERIAL_KILLER',
      message: 'Kẻ Sát Nhân đã hạ sát tất cả mọi người và trở thành kẻ sống sót duy nhất!',
    };
  }

  // 2. Werewolf Victory: Wolves >= non-wolves
  const nonWolvesCount = aliveVillagers.length + aliveNeutrals.length;
  if (aliveWolves.length > 0 && aliveWolves.length >= nonWolvesCount) {
    return {
      gameOver: true,
      winner: 'WEREWOLF',
      message: 'Phe Ma Sói đã tiêu diệt đa số dân làng và chiếm lĩnh ngôi làng vĩnh viễn!',
    };
  }

  // 3. Village Victory: All wolves dead, no hostile neutrals
  if (aliveWolves.length === 0 && !aliveSerialKiller) {
    return {
      gameOver: true,
      winner: 'VILLAGE',
      message: 'Tất cả Ma Sói đã bị tiêu diệt! Bình minh trở lại và sự yên bình đã được lập lại cho Dân Làng!',
    };
  }

  // 4. Draw / Total annihilation
  if (alivePlayers.length === 0) {
    return {
      gameOver: true,
      winner: 'NEUTRAL',
      message: 'Tất cả mọi người đều đã ngã xuống trong đêm đẫm máu. Trận đấu kết thúc hòa!',
    };
  }

  return { gameOver: false };
}

// -----------------------------------------------------------------------------
// COMPLETE GAME JOURNAL
// Secret actions are recorded on the server during the game, but sanitization
// prevents them from being sent to clients until GAME_OVER.
// -----------------------------------------------------------------------------
function addGameJournal(
  room: RoomData,
  phase: GamePhase,
  message: string,
  type: GameState['logs'][number]['type'] = 'INFO',
) {
  if (!room.gameState) return;

  room.gameState.logs.push({
    id: `journal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    round: room.gameState.roundNumber,
    phase,
    timestamp: Date.now(),
    message,
    type,
    isPublic: false,
  });
}

// Start Game and assign Roles
function startGame(room: RoomData) {
  const validation = validateDeck(room.deck, room.players.length, room.settings.mode);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Expand Deck cards
  const deckPool: RoleId[] = [];
  room.deck.forEach((item) => {
    for (let i = 0; i < item.count; i++) {
      deckPool.push(item.roleId);
    }
  });

  // Shuffle Deck Server-Side
  const shuffledRoles = shuffleArray(deckPool);

  // Assign roles
  room.players.forEach((p, idx) => {
    p.role = shuffledRoles[idx];
    p.isAlive = true;
    p.deathReason = undefined;
    p.deathRound = undefined;
    p.protectedCount = 0;
  });

  room.status = 'IN_PROGRESS';
  room.gameState = {
    roomId: room.id,
    status: 'IN_PROGRESS',
    currentPhase: 'ROLE_REVEAL',
    roundNumber: 1,
    phaseEndsAt: Date.now() + 8000, // 8s to read role
    phaseDuration: 8,
    deck: room.deck,
    lastNightVictims: [],
    deathRebuttalPlayerIds: [],
    logs: [
      {
        id: `log_${Date.now()}_start`,
        round: 1,
        phase: 'ROLE_REVEAL',
        timestamp: Date.now(),
        message: 'Trận đấu bắt đầu. Thẻ bài bí mật đã được Quản Trò phân phát đến từng người chơi!',
        type: 'INFO',
        isPublic: true,
      },
    ],
  };

  broadcastRoom(room.id, 'ROLE_ASSIGNED');

  // Transition to Night 1 after Role Reveal
  setTimeout(() => {
    if (room.gameState && room.gameState.currentPhase === 'ROLE_REVEAL') {
      startNightPhase(room);
    }
  }, 8000);
}

// -----------------------------------------------------------------------------
// NIGHT STATE MACHINE
// -----------------------------------------------------------------------------
// Night is a sequence of short, authoritative steps. The server owns the
// timers; clients only submit decisions. This prevents different devices from
// resolving the same night differently.
//
// 1) Night 1 + Cupid: 60s
// 2) Werewolves: 45s (Alpha Wolf is the sole decider; otherwise consensus)
// 3) Serial Killer: 60s
// 4) Witch heal: 30s, then Witch poison: 30s
// 5) Seer + Bodyguard + Lieu: simultaneous 60s
// 6) Resolve night -> day
//
// A step advances immediately when every required player has submitted, or
// when the step timer expires. A late packet from an old step is ignored.

function getAlivePlayersByRole(room: RoomData, role: RoleId): Player[] {
  return room.players.filter((p) => p.isAlive && p.role === role);
}

function getAliveWerewolves(room: RoomData): Player[] {
  return room.players.filter(
    (p) => p.isAlive && p.role && ROLES_DATABASE[p.role]?.team === 'WEREWOLF'
  );
}

function getNightStepDuration(step: NightState['currentStep']): number {
  switch (step) {
    case 'CUPID_PAIR':
      return 60;
    case 'WEREWOLF_HUNT':
      return 45;
    case 'SERIAL_KILLER_HUNT':
      return 60;
    case 'WITCH_HEAL':
    case 'WITCH_POISON':
      return 30;
    case 'OTHER_ROLES':
      return 60;
    default:
      return 0;
  }
}

function broadcastNight(room: RoomData) {
  broadcastRoom(room.id, 'ROOM_STATE');
}

function forceNightVoice(room: RoomData, wolvesCanTalk: boolean) {
  if (!room.voiceStates) room.voiceStates = {};

  room.players.forEach((p) => {
    const isWolf = !!p.role && ROLES_DATABASE[p.role]?.team === 'WEREWOLF';
    const canTalk = wolvesCanTalk && p.isAlive && isWolf;

    const existing = room.voiceStates![p.id] || {
      playerId: p.id,
      nickname: p.nickname,
      isMuted: true,
      isSpeaking: false,
      isDeafened: false,
      isSilenced: p.isSilenced,
    };

    room.voiceStates![p.id] = {
      ...existing,
      nickname: p.nickname,
      isMuted: !canTalk,
      isSpeaking: false,
      // Non-wolves are also deafened while wolves are discussing. The client
      // will restore normal hearing when the wolf step ends.
      isDeafened: wolvesCanTalk ? !canTalk : false,
      isSilenced: p.isSilenced,
    };
  });

  broadcastRoom(room.id, 'VOICE_STATUS_UPDATE', {
    voiceStates: room.voiceStates,
  });
  if (!wolvesCanTalk) {
    broadcastRoom(room.id, 'VOICE_FORCE_MUTE_ALL');
  }
}

function forceDeathRebuttalVoice(room: RoomData) {
  if (!room.voiceStates) room.voiceStates = {};
  const allowed = new Set(room.gameState?.deathRebuttalPlayerIds || []);

  room.players.forEach((p) => {
    const canTalk = allowed.has(p.id) && p.isAlive === false && !p.isSilenced;
    const existing = room.voiceStates![p.id] || {
      playerId: p.id,
      nickname: p.nickname,
      isMuted: true,
      isSpeaking: false,
      isDeafened: false,
      isSilenced: p.isSilenced,
    };

    room.voiceStates![p.id] = {
      ...existing,
      nickname: p.nickname,
      isMuted: !canTalk,
      isSpeaking: false,
      isDeafened: false,
      isSilenced: p.isSilenced,
    };
  });

  broadcastRoom(room.id, 'VOICE_STATUS_UPDATE', { voiceStates: room.voiceStates });
}

function startDeathRebuttal(room: RoomData, playerIds: string[]) {
  if (!room.gameState || playerIds.length === 0) return false;

  const validIds = playerIds.filter((id) => {
    const p = room.players.find((x) => x.id === id);
    return !!p && !p.isAlive;
  });
  if (validIds.length === 0) return false;

  room.gameState.currentPhase = 'DEATH_REBUTTAL';
  room.gameState.deathRebuttalPlayerIds = validIds;
  room.gameState.phaseDuration = 30;
  room.gameState.phaseEndsAt = Date.now() + 30000;

  room.gameState.logs.push({
    id: `log_rebuttal_${Date.now()}`,
    round: room.gameState.roundNumber,
    phase: 'DEATH_REBUTTAL',
    timestamp: Date.now(),
    message: `⚰️ Người vừa chết có 30 giây để phản biện cuối cùng. Mic và chat chung đã mở cho họ.`,
    type: 'INFO',
    isPublic: true,
  });

  const rebuttalNames = validIds
    .map((id) => room.players.find((p) => p.id === id)?.nickname)
    .filter(Boolean)
    .join(', ');
  addGameJournal(
    room,
    'DEATH_REBUTTAL',
    `🎙️ Phản biện cuối: ${rebuttalNames}. Thời lượng 30 giây.`,
    'INFO',
  );

  forceDeathRebuttalVoice(room);
  broadcastRoom(room.id, 'PHASE_CHANGED', { newPhase: 'DEATH_REBUTTAL' });

  setTimeout(() => {
    if (room.gameState?.currentPhase !== 'DEATH_REBUTTAL') return;
    room.gameState.deathRebuttalPlayerIds = [];
    forceNightVoice(room, false);

    const victoryCheck = checkVictory(room);
    if (victoryCheck.gameOver) {
      triggerGameOver(room, victoryCheck.winner!, victoryCheck.message!);
      return;
    }

    room.gameState.roundNumber += 1;
    startNightPhase(room);
  }, 30050);

  return true;
}

function startNightPhase(room: RoomData) {
  if (!room.gameState) return;

  const prevNightState = room.gameState.nightState;
  const round = room.gameState.roundNumber;

  // A dead Wolf Pup from the immediately preceding round activates the next
  // night's two-kill frenzy exactly once.
  const wolfPupDiedPreviousRound = room.players.some(
    (p) => p.role === 'WOLF_PUP' && !p.isAlive && p.deathRound === round - 1
  );

  room.gameState.currentPhase = 'NIGHT';
  room.gameState.nightState = {
    currentStep: 'NONE',
    stepTimeRemaining: 0,
    stepStartedAt: Date.now(),
    werewolfVotes: {},
    werewolfConfirmations: {},
    werewolfKillTargets: [],
    werewolfKillIndex: 0,
    werewolfMaxKills: wolfPupDiedPreviousRound ? 2 : 1,
    witchSaved: false,
    witchHasHeal: prevNightState ? prevNightState.witchHasHeal : true,
    witchHasPoison: prevNightState ? prevNightState.witchHasPoison : true,
    lastGuardedPlayerId: prevNightState?.lastGuardedPlayerId,
    nightVictims: [],
    witchVictimIds: [],
    witchVictimNames: [],
  };

  // Reset one-day silences before applying the new night's Liễu action.
  room.players.forEach((p) => {
    if (p.isSilenced && (p.silencedUntilRound || 0) < round) {
      p.isSilenced = false;
    }
  });

  room.gameState.logs.push({
    id: `log_night_${round}_${Date.now()}`,
    round,
    phase: 'NIGHT',
    timestamp: Date.now(),
    message: `🌙 Đêm thứ ${round} buông xuống...`,
    type: 'INFO',
    isPublic: true,
  });

  broadcastRoom(room.id, 'PHASE_CHANGED', { newPhase: 'NIGHT' });

  // Cupid gets the first move only in Night 1.
  if (round === 1 && getAlivePlayersByRole(room, 'CUPID').length > 0) {
    enterNightStep(room, 'CUPID_PAIR');
  } else {
    enterNightStep(room, 'WEREWOLF_HUNT');
  }
}

function handleNightStepTimeout(room: RoomData, step: NightState['currentStep']) {
  const ns = room.gameState?.nightState;
  if (!ns || room.gameState?.currentPhase !== 'NIGHT' || ns.currentStep !== step) return;

  if (step === 'WEREWOLF_HUNT') {
    // Explicit fallback: if the wolves have not reached a final decision when
    // the timer expires, the server automatically chooses a valid non-wolf.
    const candidates = room.players.filter(
      (p) =>
        p.isAlive &&
        p.role &&
        ROLES_DATABASE[p.role]?.team !== 'WEREWOLF' &&
        !ns.werewolfKillTargets.includes(p.id)
    );

    if (candidates.length > 0) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      finalizeWolfTarget(room, target.id);
      if (ns.werewolfKillTargets.length >= ns.werewolfMaxKills) {
        advanceNightStep(room);
      }
      return;
    }
  }

  // Serial Killer, Witch and the simultaneous roles simply keep their default
  // "no action" result when their timers expire.
  advanceNightStep(room);
}

function enterNightStep(room: RoomData, step: NightState['currentStep']) {
  if (!room.gameState?.nightState) return;

  const ns = room.gameState.nightState;
  const duration = getNightStepDuration(step);
  ns.currentStep = step;
  ns.stepTimeRemaining = duration;
  ns.stepStartedAt = Date.now();

  // Populate the private Witch briefing from the already-finalized wolf target(s).
  if (step === 'WITCH_HEAL') {
    const wolfVictims = ns.werewolfKillTargets
      .map((id) => room.players.find((p) => p.id === id))
      .filter((p): p is Player => !!p && p.isAlive);

    ns.witchVictimIds = wolfVictims.map((p) => p.id);
    ns.witchVictimNames = wolfVictims.map((p) => p.nickname);
    ns.witchVictimId = ns.witchVictimIds[0];
    ns.witchVictimName = ns.witchVictimNames[0];
  }

  room.gameState.phaseDuration = duration;
  room.gameState.phaseEndsAt = Date.now() + duration * 1000;

  // The only night step where voice is deliberately open is the Werewolf
  // discussion. All other steps are private/silent.
  forceNightVoice(room, step === 'WEREWOLF_HUNT');

  broadcastRoom(room.id, 'PHASE_CHANGED', {
    newPhase: 'NIGHT',
    nightStep: step,
    duration,
  });
  broadcastNight(room);

  // Skip steps that have no living actor or no remaining ability.
  if (
    (step === 'CUPID_PAIR' && getAlivePlayersByRole(room, 'CUPID').length === 0) ||
    (step === 'WEREWOLF_HUNT' && getAliveWerewolves(room).length === 0) ||
    (step === 'SERIAL_KILLER_HUNT' && getAlivePlayersByRole(room, 'SERIAL_KILLER').length === 0) ||
    (step === 'WITCH_HEAL' && (getAlivePlayersByRole(room, 'WITCH').length === 0 || !ns.witchHasHeal || !ns.witchVictimId)) ||
    (step === 'WITCH_POISON' && (getAlivePlayersByRole(room, 'WITCH').length === 0 || !ns.witchHasPoison)) ||
    (step === 'OTHER_ROLES' && getAliveActionRoles(room).length === 0)
  ) {
    advanceNightStep(room);
    return;
  }

  simulateBotNightStep(room);
  void simulateSmartBotNightStep(room);

  if (
    room.gameState?.currentPhase === 'NIGHT' &&
    room.gameState?.nightState?.currentStep === step &&
    allRequiredNightActionsSubmitted(room)
  ) {
    advanceNightStep(room);
    return;
  }

  if (duration <= 0) {
    advanceNightStep(room);
    return;
  }

  setTimeout(() => {
    const current = room.gameState?.nightState;
    if (
      room.gameState?.currentPhase === 'NIGHT' &&
      current?.currentStep === step &&
      current.stepStartedAt === ns.stepStartedAt
    ) {
      handleNightStepTimeout(room, step);
    }
  }, duration * 1000 + 50);
}

function getAliveActionRoles(room: RoomData): RoleId[] {
  const roles: RoleId[] = [];
  (['SEER', 'BODYGUARD', 'LIEU'] as RoleId[]).forEach((role) => {
    if (getAlivePlayersByRole(room, role).length > 0) roles.push(role);
  });
  return roles;
}

function advanceNightStep(room: RoomData) {
  if (!room.gameState?.nightState) return;
  const ns = room.gameState.nightState;

  switch (ns.currentStep) {
    case 'CUPID_PAIR':
      enterNightStep(room, 'WEREWOLF_HUNT');
      break;

    case 'WEREWOLF_HUNT':
      // If the wolf step timed out with no valid decision, no wolf victim is
      // selected. For Wolf Pup frenzy, each accepted target is collected in
      // separate consensus rounds.
      enterNightStep(room, 'SERIAL_KILLER_HUNT');
      break;

    case 'SERIAL_KILLER_HUNT':
      if (getAlivePlayersByRole(room, 'WITCH').length > 0) {
        enterNightStep(room, 'WITCH_HEAL');
      } else if (getAliveActionRoles(room).length > 0) {
        enterNightStep(room, 'OTHER_ROLES');
      } else {
        resolveNightActions(room);
      }
      break;

    case 'WITCH_HEAL':
      if (getAlivePlayersByRole(room, 'WITCH').length > 0 && ns.witchHasPoison) {
        enterNightStep(room, 'WITCH_POISON');
      } else if (getAliveActionRoles(room).length > 0) {
        enterNightStep(room, 'OTHER_ROLES');
      } else {
        resolveNightActions(room);
      }
      break;

    case 'WITCH_POISON':
      if (getAliveActionRoles(room).length > 0) {
        enterNightStep(room, 'OTHER_ROLES');
      } else {
        resolveNightActions(room);
      }
      break;

    case 'OTHER_ROLES':
      resolveNightActions(room);
      break;

    default:
      resolveNightActions(room);
      break;
  }
}

function simulateBotNightStep(room: RoomData) {
  const ns = room.gameState?.nightState;
  if (!ns) return;

  const bots = room.players.filter((p) => p.isAlive && p.isBot && p.botType !== 'GEMINI' && p.role);
  const alive = room.players.filter((p) => p.isAlive);

  if (ns.currentStep === 'CUPID_PAIR') {
    const cupid = bots.find((p) => p.role === 'CUPID');
    if (cupid) {
      const targets = alive.filter((p) => p.id !== cupid.id);
      if (targets.length >= 2) {
        handleNightAction(room, cupid.id, {
          actionType: 'CUPID_PAIR',
          actorPlayerId: cupid.id,
          targetPlayerId: targets[0].id,
          extraData: { secondTargetPlayerId: targets[1].id },
        });
      }
    }
    return;
  }

  if (ns.currentStep === 'WEREWOLF_HUNT') {
    const wolves = getAliveWerewolves(room);
    const alpha = wolves.find((p) => p.role === 'ALPHA_WOLF');

    // Alpha is the sole final decision maker.
    if (alpha?.isBot) {
      const targets = alive.filter(
        (p) =>
          p.role &&
          ROLES_DATABASE[p.role]?.team !== 'WEREWOLF' &&
          !ns.werewolfKillTargets.includes(p.id)
      );
      if (targets.length > 0) {
        handleNightAction(room, alpha.id, {
          actionType: 'WOLF_KILL',
          actorPlayerId: alpha.id,
          targetPlayerId: targets[Math.floor(Math.random() * targets.length)].id,
        });
      }
      return;
    }

    // Without Alpha, the first bot wolf can propose a target. Other bot wolves
    // automatically vote YES on that proposal.
    const proposer = wolves.find((p) => p.isBot);
    if (proposer && !ns.werewolfProposalTarget) {
      const targets = alive.filter(
        (p) =>
          p.role &&
          ROLES_DATABASE[p.role]?.team !== 'WEREWOLF' &&
          !ns.werewolfKillTargets.includes(p.id)
      );
      if (targets.length > 0) {
        handleNightAction(room, proposer.id, {
          actionType: 'WOLF_KILL',
          actorPlayerId: proposer.id,
          targetPlayerId: targets[Math.floor(Math.random() * targets.length)].id,
        });
      }
    }

    if (ns.werewolfProposalTarget) {
      wolves
        .filter((p) => p.isBot && p.id !== proposer?.id)
        .forEach((botWolf) => {
          handleNightAction(room, botWolf.id, {
            actionType: 'WOLF_CONFIRM',
            actorPlayerId: botWolf.id,
            targetPlayerId: ns.werewolfProposalTarget,
            extraData: { confirmed: true },
          });
        });
    }
    return;
  }

  if (ns.currentStep === 'SERIAL_KILLER_HUNT') {
    const sk = bots.find((p) => p.role === 'SERIAL_KILLER');
    if (sk) {
      const targets = alive.filter((p) => p.id !== sk.id);
      if (targets.length > 0) {
        handleNightAction(room, sk.id, {
          actionType: 'SERIAL_KILL',
          actorPlayerId: sk.id,
          targetPlayerId: targets[Math.floor(Math.random() * targets.length)].id,
        });
      }
    }
    return;
  }

  if (ns.currentStep === 'WITCH_HEAL') {
    const witch = bots.find((p) => p.role === 'WITCH');
    if (witch && ns.witchHasHeal && ns.witchVictimId) {
      // Bots preserve the same general behaviour as before, but the decision
      // is now made in the correct sequential Witch step.
      if (Math.random() < 0.65) {
        handleNightAction(room, witch.id, {
          actionType: 'WITCH_HEAL',
          actorPlayerId: witch.id,
        });
      } else {
        handleNightAction(room, witch.id, {
          actionType: 'WITCH_DECLINE_HEAL',
          actorPlayerId: witch.id,
        });
      }
    }
    return;
  }

  if (ns.currentStep === 'WITCH_POISON') {
    const witch = bots.find((p) => p.role === 'WITCH');
    if (witch && ns.witchHasPoison && Math.random() < 0.3) {
      const targets = alive.filter(
        (p) => p.id !== witch.id && p.id !== ns.witchVictimId
      );
      if (targets.length > 0) {
        handleNightAction(room, witch.id, {
          actionType: 'WITCH_POISON',
          actorPlayerId: witch.id,
          targetPlayerId: targets[Math.floor(Math.random() * targets.length)].id,
        });
      } else {
        handleNightAction(room, witch.id, {
          actionType: 'WITCH_DECLINE_POISON',
          actorPlayerId: witch.id,
        });
      }
    }
    return;
  }

  if (ns.currentStep === 'OTHER_ROLES') {
    bots.forEach((bot) => {
      if (bot.role === 'SEER') {
        const targets = alive.filter((p) => p.id !== bot.id);
        if (targets.length > 0) {
          handleNightAction(room, bot.id, {
            actionType: 'SEER_CHECK',
            actorPlayerId: bot.id,
            targetPlayerId: targets[Math.floor(Math.random() * targets.length)].id,
          });
        }
      } else if (bot.role === 'BODYGUARD') {
        const targets = alive.filter((p) => p.id !== ns.lastGuardedPlayerId);
        if (targets.length > 0) {
          handleNightAction(room, bot.id, {
            actionType: 'BODYGUARD_GUARD',
            actorPlayerId: bot.id,
            targetPlayerId: targets[Math.floor(Math.random() * targets.length)].id,
          });
        }
      } else if (bot.role === 'LIEU') {
        const targets = alive.filter((p) => p.id !== bot.id);
        if (targets.length > 0) {
          handleNightAction(room, bot.id, {
            actionType: 'LIEU_SILENCE',
            actorPlayerId: bot.id,
            targetPlayerId: targets[Math.floor(Math.random() * targets.length)].id,
          });
        }
      }
    });
  }
}


async function simulateSmartBotNightStep(room: RoomData) {
  const ns = room.gameState?.nightState;
  if (!ns) return;

  const smartBots = room.players.filter(
    (p) => p.isAlive && p.isBot && p.botType === 'GEMINI' && p.role
  );
  if (smartBots.length === 0) return;

  // Gemini chỉ điều khiển các bot được đánh dấu GEMINI. Bot Test cũ
  // tiếp tục chạy bằng logic cũ và không bị Gemini can thiệp.
  const stepAtStart = ns.currentStep;
  for (const smartBot of smartBots) {
    if (
      room.gameState?.currentPhase !== 'NIGHT' ||
      room.gameState?.nightState?.currentStep !== stepAtStart
    ) return;

    const aiAction = await chooseBotNightAction(room, smartBot);
    if (
      room.gameState?.currentPhase !== 'NIGHT' ||
      room.gameState?.nightState?.currentStep !== stepAtStart
    ) return;

    if (aiAction) {
      handleNightAction(room, smartBot.id, aiAction);
    }
  }
}

function allRequiredNightActionsSubmitted(room: RoomData): boolean {
  const ns = room.gameState?.nightState;
  if (!ns) return true;

  if (ns.currentStep === 'CUPID_PAIR') {
    const cupid = getAlivePlayersByRole(room, 'CUPID')[0];
    return !cupid || !!ns.loverPair;
  }

  if (ns.currentStep === 'WEREWOLF_HUNT') {
    const wolves = getAliveWerewolves(room);
    const alpha = wolves.find((p) => p.role === 'ALPHA_WOLF');

    if (alpha) {
      return ns.werewolfKillTargets.length >= ns.werewolfMaxKills;
    }

    if (wolves.length === 1) {
      return ns.werewolfKillTargets.length >= ns.werewolfMaxKills;
    }
    if (!ns.werewolfProposalTarget) return false;

    const otherWolves = wolves.filter((p) => p.id !== undefined);
    const responders = otherWolves.filter((p) => p.id !== undefined);
    const answered = responders.filter(
      (p) => ns.werewolfConfirmations[p.id] !== undefined
    );

    // The proposer counts as an implicit YES. With two wolves, the second
    // wolf's YES is therefore enough to form a majority.
    const yes = 1 + answered.filter((p) => ns.werewolfConfirmations[p.id] === true).length;
    const no = answered.filter((p) => ns.werewolfConfirmations[p.id] === false).length;
    const total = wolves.length;

    if (yes > total / 2) return true;
    if (answered.length === total - 1 && no >= total / 2) return true;
    return false;
  }

  if (ns.currentStep === 'SERIAL_KILLER_HUNT') {
    const sk = getAlivePlayersByRole(room, 'SERIAL_KILLER')[0];
    return !sk || !!ns.serialKillerConfirmed;
  }

  if (ns.currentStep === 'WITCH_HEAL') {
    const witch = getAlivePlayersByRole(room, 'WITCH')[0];
    return !witch || ns.witchHasHeal === false || ns.witchSaved || ns.witchPoisonTarget !== undefined;
  }

  if (ns.currentStep === 'WITCH_POISON') {
    const witch = getAlivePlayersByRole(room, 'WITCH')[0];
    return !witch || ns.witchHasPoison === false || ns.witchPoisonTarget !== undefined;
  }

  if (ns.currentStep === 'OTHER_ROLES') {
    const roles = getAliveActionRoles(room);
    return roles.every((role) => {
      const actor = getAlivePlayersByRole(room, role)[0];
      if (!actor) return true;
      if (role === 'SEER') return !!ns.seerTarget;
      if (role === 'BODYGUARD') return !!ns.bodyguardTarget;
      if (role === 'LIEU') return !!ns.lieuTarget;
      return true;
    });
  }

  return true;
}

function resetWolfProposal(room: RoomData) {
  const ns = room.gameState?.nightState;
  if (!ns) return;

  ns.werewolfProposalTarget = undefined;
  ns.werewolfConfirmations = {};
  ns.werewolfVotes = {};
  ns.werewolfTarget = undefined;
}

function finalizeWolfTarget(room: RoomData, targetId: string): boolean {
  const ns = room.gameState?.nightState;
  if (!ns) return false;

  const target = room.players.find((p) => p.id === targetId);
  if (!target || !target.isAlive) return false;
  if (target.role && ROLES_DATABASE[target.role]?.team === 'WEREWOLF') return false;

  if (!ns.werewolfKillTargets.includes(targetId)) {
    ns.werewolfKillTargets.push(targetId);
  }
  ns.werewolfTarget = targetId;

  const wolfNames = getAliveWerewolves(room).map((p) => p.nickname).join(', ');
  addGameJournal(
    room,
    'NIGHT',
    `🐺 ${wolfNames || 'Phe Ma Sói'} đã chốt mục tiêu cắn: ${target.nickname}.`,
    'NIGHT_ACTION',
  );

  if (ns.werewolfKillTargets.length < ns.werewolfMaxKills) {
    // Wolf Pup frenzy: start another 45-second consensus for the second bite.
    resetWolfProposal(room);
    enterNightStep(room, 'WEREWOLF_HUNT');
  }

  return true;
}

function handleNightAction(room: RoomData, playerId: string, action: GameAction) {
  if (!room.gameState?.nightState || room.gameState.currentPhase !== 'NIGHT') return;

  const ns = room.gameState.nightState;
  const player = room.players.find((p) => p.id === playerId);
  if (!player || !player.isAlive || !player.role) return;

  const isWolf = ROLES_DATABASE[player.role]?.team === 'WEREWOLF';

  if (ns.currentStep === 'CUPID_PAIR' && action.actionType === 'CUPID_PAIR' && player.role === 'CUPID') {
    const firstId = action.targetPlayerId;
    const secondId = action.extraData?.secondTargetPlayerId;
    const first = room.players.find((p) => p.id === firstId);
    const second = room.players.find((p) => p.id === secondId);

    if (!first || !second || !first.isAlive || !second.isAlive || first.id === second.id) return;
    ns.loverPair = [first.id, second.id];
    ns.cupidPlayerId = player.id;

    addGameJournal(
      room,
      'NIGHT',
      `💘 Thần Tình Yêu ${player.nickname} đã ghép ${first.nickname} ❤️ ${second.nickname}.`,
      'NIGHT_ACTION',
    );

    // Only these three players receive the pair identity.
    const partnerOf = (id: string) => (id === first.id ? second : first);
    [player, first, second].forEach((recipient) => {
      sendToPlayer(recipient.id, 'ACTION_RESULT', {
        actionType: 'CUPID_PAIR',
        partnerId: partnerOf(recipient.id).id,
        partnerName: partnerOf(recipient.id).nickname,
        message:
          recipient.id === player.id
            ? `💘 Bạn đã ghép ${first.nickname} ❤️ ${second.nickname}. Chỉ bạn và hai người này biết cặp đôi.`
            : `💘 Bạn đã được ghép cặp với ${partnerOf(recipient.id).nickname}. Chỉ bạn, người kia và Thần Tình Yêu biết điều này.`,
      });
    });

    broadcastNight(room);
    advanceNightStep(room);
    return;
  }

  if (ns.currentStep === 'WEREWOLF_HUNT' && isWolf) {
    const alpha = getAliveWerewolves(room).find((p) => p.role === 'ALPHA_WOLF');

    if (action.actionType === 'WOLF_KILL' && action.targetPlayerId) {
      const target = room.players.find((p) => p.id === action.targetPlayerId);
      if (!target || !target.isAlive) return;
      if (target.role && ROLES_DATABASE[target.role]?.team === 'WEREWOLF') {
        sendToPlayer(playerId, 'ERROR', { message: '🐺 Không thể chọn Ma Sói làm mục tiêu.' });
        return;
      }
      if (ns.werewolfKillTargets.includes(target.id)) {
        sendToPlayer(playerId, 'ERROR', { message: '🐺 Sói Con đang cuồng nộ: mục tiêu thứ hai phải là một người khác.' });
        return;
      }

      if (alpha) {
        if (player.id !== alpha.id) {
          sendToPlayer(playerId, 'ERROR', { message: '🐺 Sói Trưởng là người quyết định cuối cùng.' });
          return;
        }

        finalizeWolfTarget(room, target.id);
        if (ns.werewolfKillTargets.length >= ns.werewolfMaxKills) {
          advanceNightStep(room);
        }
        return;
      }

      // First wolf to submit creates the single proposal.
      if (!ns.werewolfProposalTarget) {
        if (getAliveWerewolves(room).length === 1) {
          finalizeWolfTarget(room, target.id);
          if (ns.werewolfKillTargets.length >= ns.werewolfMaxKills) {
            advanceNightStep(room);
          }
          return;
        }

        ns.werewolfProposalTarget = target.id;
        ns.werewolfTarget = target.id;
        ns.werewolfVotes[player.id] = target.id;
        broadcastNight(room);
        return;
      }

      return;
    }

    if (
      action.actionType === 'WOLF_CONFIRM' &&
      ns.werewolfProposalTarget &&
      player.id !== undefined &&
      action.targetPlayerId === ns.werewolfProposalTarget
    ) {
      // The proposer is already an implicit YES and cannot vote twice.
      const proposerId = Object.keys(ns.werewolfVotes)[0];
      if (player.id === proposerId) return;

      ns.werewolfConfirmations[player.id] = action.extraData?.confirmed === true;

      const wolves = getAliveWerewolves(room);
      const yes =
        1 +
        wolves.filter(
          (p) => p.id !== proposerId && ns.werewolfConfirmations[p.id] === true
        ).length;
      const answeredOthers = wolves.filter(
        (p) => p.id !== proposerId && ns.werewolfConfirmations[p.id] !== undefined
      );
      const no = answeredOthers.filter(
        (p) => ns.werewolfConfirmations[p.id] === false
      ).length;

      if (yes > wolves.length / 2) {
        finalizeWolfTarget(room, ns.werewolfProposalTarget);
        if (ns.werewolfKillTargets.length >= ns.werewolfMaxKills) {
          advanceNightStep(room);
        }
      } else if (
        answeredOthers.length === wolves.length - 1 &&
        no >= wolves.length / 2
      ) {
        // Proposal rejected. Wolves must make a new decision; the same target
        // is not locked in.
        resetWolfProposal(room);
        broadcastNight(room);
      } else {
        broadcastNight(room);
      }
      return;
    }

    return;
  }

  if (ns.currentStep === 'SERIAL_KILLER_HUNT' && player.role === 'SERIAL_KILLER') {
    if (action.actionType === 'SERIAL_KILL' && action.targetPlayerId) {
      const target = room.players.find((p) => p.id === action.targetPlayerId);
      if (target?.isAlive && target.id !== player.id) {
        ns.serialKillerTarget = target.id;
        ns.serialKillerConfirmed = true;
        addGameJournal(
          room,
          'NIGHT',
          `🔪 Kẻ Sát Nhân ${player.nickname} đã chọn ${target.nickname} làm mục tiêu.`,
          'NIGHT_ACTION',
        );
        broadcastNight(room);
        advanceNightStep(room);
      }
    } else if (action.actionType === 'SERIAL_KILL_SKIP') {
      ns.serialKillerTarget = undefined;
      ns.serialKillerConfirmed = true;
      addGameJournal(
        room,
        'NIGHT',
        `🔪 Kẻ Sát Nhân ${player.nickname} đã quyết định không ra tay đêm nay.`,
        'NIGHT_ACTION',
      );
      broadcastNight(room);
      advanceNightStep(room);
    }
    return;
  }

  if (ns.currentStep === 'WITCH_HEAL' && player.role === 'WITCH') {
    if (action.actionType === 'WITCH_HEAL' && ns.witchHasHeal && ns.witchVictimId) {
      ns.witchSaved = true;
      ns.witchHasHeal = false;
      const healTarget = room.players.find((p) => p.id === ns.witchVictimId);
      addGameJournal(
        room,
        'NIGHT',
        `🧪 Phù Thủy ${player.nickname} đã dùng Thuốc Cứu để cứu ${healTarget?.nickname || 'mục tiêu bị Sói tấn công'}.`,
        'NIGHT_ACTION',
      );
      broadcastNight(room);
      advanceNightStep(room);
    } else if (
      action.actionType === 'WITCH_DECLINE_HEAL' ||
      action.actionType === 'WITCH_SKIP'
    ) {
      // "No" does not consume the potion.
      addGameJournal(
        room,
        'NIGHT',
        `🧪 Phù Thủy ${player.nickname} đã không dùng Thuốc Cứu trong đêm này.`,
        'NIGHT_ACTION',
      );
      broadcastNight(room);
      advanceNightStep(room);
    }
    return;
  }

  if (ns.currentStep === 'WITCH_POISON' && player.role === 'WITCH') {
    if (
      action.actionType === 'WITCH_POISON' &&
      ns.witchHasPoison &&
      action.targetPlayerId
    ) {
      const target = room.players.find((p) => p.id === action.targetPlayerId);
      if (target?.isAlive && target.id !== player.id) {
        ns.witchPoisonTarget = target.id;
        ns.witchHasPoison = false;
        addGameJournal(
          room,
          'NIGHT',
          `☠️ Phù Thủy ${player.nickname} đã dùng Thuốc Độc lên ${target.nickname}.`,
          'NIGHT_ACTION',
        );
        broadcastNight(room);
        advanceNightStep(room);
      }
    } else if (
      action.actionType === 'WITCH_DECLINE_POISON' ||
      action.actionType === 'WITCH_SKIP'
    ) {
      addGameJournal(
        room,
        'NIGHT',
        `☠️ Phù Thủy ${player.nickname} đã không dùng Thuốc Độc trong đêm này.`,
        'NIGHT_ACTION',
      );
      broadcastNight(room);
      advanceNightStep(room);
    }
    return;
  }

  if (ns.currentStep === 'OTHER_ROLES') {
    if (action.actionType === 'SEER_CHECK' && player.role === 'SEER' && action.targetPlayerId) {
      const target = room.players.find((p) => p.id === action.targetPlayerId);
      if (!target?.isAlive || target.id === player.id) return;
      ns.seerTarget = target.id;
      const isWolf = !!target.role && ROLES_DATABASE[target.role]?.team === 'WEREWOLF';
      addGameJournal(
        room,
        'NIGHT',
        `🔮 Tiên Tri ${player.nickname} đã soi ${target.nickname} và kết quả là ${isWolf ? 'Ma Sói' : 'không phải Ma Sói'}.`,
        'NIGHT_ACTION',
      );
      sendToPlayer(playerId, 'ACTION_RESULT', {
        actionType: 'SEER_CHECK',
        targetName: target.nickname,
        isWerewolf: isWolf,
      });
      broadcastNight(room);
      if (allRequiredNightActionsSubmitted(room)) advanceNightStep(room);
      return;
    }

    if (action.actionType === 'BODYGUARD_GUARD' && player.role === 'BODYGUARD' && action.targetPlayerId) {
      if (ns.lastGuardedPlayerId === action.targetPlayerId) {
        sendToPlayer(playerId, 'ERROR', {
          message: 'Không thể bảo vệ cùng 1 người trong 2 đêm liên tiếp.',
        });
        return;
      }
      const target = room.players.find((p) => p.id === action.targetPlayerId);
      if (!target?.isAlive) return;
      ns.bodyguardTarget = target.id;
      ns.lastGuardedPlayerId = target.id;
      addGameJournal(
        room,
        'NIGHT',
        `🛡️ Bảo Vệ ${player.nickname} đã bảo vệ ${target.nickname}.`,
        'NIGHT_ACTION',
      );
      broadcastNight(room);
      if (allRequiredNightActionsSubmitted(room)) advanceNightStep(room);
      return;
    }

    if (action.actionType === 'LIEU_SILENCE' && player.role === 'LIEU' && action.targetPlayerId) {
      const target = room.players.find((p) => p.id === action.targetPlayerId);
      if (!target?.isAlive || target.id === player.id) return;
      ns.lieuTarget = target.id;
      addGameJournal(
        room,
        'NIGHT',
        `🤫 Liễu ${player.nickname} đã chọn làm câm lặng ${target.nickname} trong ngày kế tiếp.`,
        'NIGHT_ACTION',
      );
      sendToPlayer(playerId, 'ACTION_RESULT', {
        actionType: 'LIEU_SILENCE',
        targetName: target.nickname,
        success: true,
      });
      broadcastNight(room);
      if (allRequiredNightActionsSubmitted(room)) advanceNightStep(room);
      return;
    }
  }
}

function handleHunterRevengeAction(room: RoomData, playerId: string, action: GameAction) {
  if (!room.gameState || room.gameState.currentPhase !== 'HUNTER_REVENGE') return;
  const hunterId = room.gameState.hunterMustShootPlayerId;
  if (!hunterId || playerId !== hunterId || action.actionType !== 'HUNTER_KILL' || !action.targetPlayerId) return;

  const hunter = room.players.find((p) => p.id === hunterId);
  const target = room.players.find((p) => p.id === action.targetPlayerId);
  if (!hunter || !target || !hunter.isAlive || !target.isAlive || target.id === hunter.id) return;

  target.isAlive = false;
  target.deathReason = 'Bị Thợ Săn bắn hạ';
  target.deathRound = room.gameState.roundNumber;
  target.deathPhase = 'HUNTER';
  room.gameState.lastNightVictims.push({
    playerId: target.id,
    playerName: target.nickname,
    roleName: ROLES_DATABASE[target.role!]?.vietnameseName,
    reason: 'Bị phát đạn cuối cùng của Thợ Săn bắn gục',
  });

  addGameJournal(
    room,
    'HUNTER_REVENGE',
    `🏹 Thợ Săn ${hunter.nickname} đã bắn ${target.nickname} trong phát đạn báo thù.`,
    'DEATH',
  );

  room.gameState.currentPhase = 'VOTE_RESOLUTION';
  broadcastRoom(room.id, 'PHASE_CHANGED', { newPhase: 'VOTE_RESOLUTION' });

  setTimeout(() => {
    if (room.gameState?.currentPhase !== 'VOTE_RESOLUTION') return;
    startDeathRebuttal(room, [hunterId, target.id]);
  }, 250);
}

function resolveNightActions(room: RoomData) {
  if (!room.gameState?.nightState) return;

  const ns = room.gameState.nightState;
  const victims: { playerId: string; playerName: string; roleName?: string; reason: string }[] = [];

  // 1. Resolve every accepted wolf target. The Wolf Pup frenzy can create two.
  ns.werewolfKillTargets.slice(0, ns.werewolfMaxKills).forEach((targetId) => {
    const targetPlayer = room.players.find((p) => p.id === targetId);
    if (!targetPlayer || !targetPlayer.isAlive) return;

    if (targetPlayer.role === 'SERIAL_KILLER') {
      room.gameState!.logs.push({
        id: `log_immune_${Date.now()}_${targetId}`,
        round: room.gameState!.roundNumber,
        phase: 'NIGHT',
        timestamp: Date.now(),
        message: 'Ma Sói đã tấn công nhưng mục tiêu có lớp giáp bí ẩn không thể xuyên thủng!',
        type: 'INFO',
        isPublic: false,
      });
      addGameJournal(room, 'NIGHT', `🐺 Ma Sói tấn công ${targetPlayer.nickname} nhưng không thể giết vì mục tiêu là Kẻ Sát Nhân.`, 'NIGHT_ACTION');
    } else if (ns.bodyguardTarget === targetId) {
      room.gameState!.logs.push({
        id: `log_bg_${Date.now()}_${targetId}`,
        round: room.gameState!.roundNumber,
        phase: 'NIGHT',
        timestamp: Date.now(),
        message: 'Bảo Vệ đã bảo vệ thành công một nạn nhân khỏi nanh vuốt Ma Sói!',
        type: 'INFO',
        isPublic: false,
      });
      addGameJournal(room, 'NIGHT', `🛡️ ${targetPlayer.nickname} được Bảo Vệ bảo vệ nên sống sót trước đòn tấn công của Ma Sói.`, 'DEATH');
    } else if (ns.witchSaved && ns.witchVictimId === targetId) {
      room.gameState!.logs.push({
        id: `log_witch_save_${Date.now()}_${targetId}`,
        round: room.gameState!.roundNumber,
        phase: 'NIGHT',
        timestamp: Date.now(),
        message: 'Phù Thủy đã kịp thời rót Thuốc Cứu Sinh giải thoát nạn nhân khỏi tay tử thần!',
        type: 'INFO',
        isPublic: false,
      });
      addGameJournal(room, 'NIGHT', `🧪 ${targetPlayer.nickname} được Phù Thủy cứu nên sống sót trước đòn tấn công của Ma Sói.`, 'DEATH');
    } else if (targetPlayer.role === 'ELDER' && (targetPlayer.protectedCount || 0) === 0) {
      targetPlayer.protectedCount = 1;
      room.gameState!.logs.push({
        id: `log_elder_${Date.now()}_${targetId}`,
        round: room.gameState!.roundNumber,
        phase: 'NIGHT',
        timestamp: Date.now(),
        message: 'Già Làng đã chống chọi kiên cường và thoát chết trong gang tấc nhờ sinh lực dẻo dai!',
        type: 'INFO',
        isPublic: false,
      });
      addGameJournal(room, 'NIGHT', `👴 ${targetPlayer.nickname} là Già Làng và đã sống sót sau đòn cắn đầu tiên của Ma Sói.`, 'DEATH');
    } else {
      targetPlayer.isAlive = false;
      targetPlayer.deathReason = 'Bị Ma Sói cắn xé';
      targetPlayer.deathRound = room.gameState!.roundNumber;
      targetPlayer.deathPhase = 'NIGHT';
      victims.push({
        playerId: targetPlayer.id,
        playerName: targetPlayer.nickname,
        roleName: ROLES_DATABASE[targetPlayer.role!]?.vietnameseName,
        reason: 'Bị Ma Sói cắn xé trong đêm',
      });
      addGameJournal(room, 'NIGHT', `💀 ${targetPlayer.nickname} đã bị Ma Sói giết trong đêm. Vai trò: ${ROLES_DATABASE[targetPlayer.role!]?.vietnameseName || 'Ẩn'}.`, 'DEATH');
    }
  });

  // 2. Serial Killer acts after the wolves.
  if (ns.serialKillerTarget) {
    const skTarget = room.players.find((p) => p.id === ns.serialKillerTarget);
    if (skTarget && skTarget.isAlive) {
      if (ns.bodyguardTarget !== skTarget.id) {
        skTarget.isAlive = false;
        skTarget.deathReason = 'Bị Kẻ Sát Nhân ám sát';
        skTarget.deathRound = room.gameState.roundNumber;
        skTarget.deathPhase = 'NIGHT';
        if (!victims.some((v) => v.playerId === skTarget.id)) {
          victims.push({
            playerId: skTarget.id,
            playerName: skTarget.nickname,
            roleName: ROLES_DATABASE[skTarget.role!]?.vietnameseName,
            reason: 'Bị nhát dao lạnh lẽo của Kẻ Sát Nhân tước đoạt',
          });
          addGameJournal(room, 'NIGHT', `🔪 ${skTarget.nickname} bị Kẻ Sát Nhân giết trong đêm. Vai trò: ${ROLES_DATABASE[skTarget.role!]?.vietnameseName || 'Ẩn'}.`, 'DEATH');
        }
      } else {
        addGameJournal(room, 'NIGHT', `🛡️ Kẻ Sát Nhân nhắm vào ${skTarget.nickname} nhưng mục tiêu được Bảo Vệ nên sống sót.`, 'DEATH');
      }
    }
  }

  // 3. Witch poison is applied after the Witch decision.
  if (ns.witchPoisonTarget) {
    const poisonTarget = room.players.find((p) => p.id === ns.witchPoisonTarget);
    if (poisonTarget && poisonTarget.isAlive) {
      if (ns.bodyguardTarget === poisonTarget.id) {
        room.gameState!.logs.push({
          id: `log_bg_poison_${Date.now()}_${poisonTarget.id}`,
          round: room.gameState!.roundNumber,
          phase: 'NIGHT',
          timestamp: Date.now(),
          message: 'Bảo Vệ đã chặn cả độc dược Phù Thủy, giữ mục tiêu sống sót qua đêm!',
          type: 'INFO',
          isPublic: false,
        });
        addGameJournal(room, 'NIGHT', `🛡️ Độc dược của Phù Thủy nhắm vào ${poisonTarget.nickname} nhưng bị Bảo Vệ chặn.`, 'DEATH');
      } else {
      poisonTarget.isAlive = false;
      poisonTarget.deathReason = 'Trúng độc dược Phù Thủy';
      poisonTarget.deathRound = room.gameState.roundNumber;
      poisonTarget.deathPhase = 'NIGHT';
      if (!victims.some((v) => v.playerId === poisonTarget.id)) {
        victims.push({
          playerId: poisonTarget.id,
          playerName: poisonTarget.nickname,
          roleName: ROLES_DATABASE[poisonTarget.role!]?.vietnameseName,
          reason: 'Bị trúng độc dược bí ẩn',
        });
        addGameJournal(room, 'NIGHT', `☠️ ${poisonTarget.nickname} bị Phù Thủy hạ độc trong đêm. Vai trò: ${ROLES_DATABASE[poisonTarget.role!]?.vietnameseName || 'Ẩn'}.`, 'DEATH');
      }
      }
    }
  }

  // 4. Apply Liễu after all simultaneous actions are known.
  if (ns.lieuTarget) {
    const lieuTargetPlayer = room.players.find((p) => p.id === ns.lieuTarget);
    if (lieuTargetPlayer && lieuTargetPlayer.isAlive) {
      lieuTargetPlayer.isSilenced = true;
      lieuTargetPlayer.silencedUntilRound = room.gameState.roundNumber;

      if (room.voiceStates?.[lieuTargetPlayer.id]) {
        room.voiceStates[lieuTargetPlayer.id].isMuted = true;
        room.voiceStates[lieuTargetPlayer.id].isSpeaking = false;
        room.voiceStates[lieuTargetPlayer.id].isSilenced = true;
      }
    }
    addGameJournal(
      room,
      'NIGHT',
      `🤫 Liễu đã khiến ${lieuTargetPlayer?.nickname || 'mục tiêu'} bị câm lặng trong ngày kế tiếp.`,
      'NIGHT_ACTION',
    );
  }

  room.gameState.lastNightVictims = victims;

  // Witch needs to know who was bitten before the Witch step begins. The victim
  // is stored privately and only exposed to the Witch by sanitization.
  // (The value is assigned below for the next night only through the same state.)
  const killedHunter = victims.find((v) => {
    const p = room.players.find((x) => x.id === v.playerId);
    return p?.role === 'HUNTER';
  });

  const victoryCheck = checkVictory(room);
  if (victoryCheck.gameOver) {
    triggerGameOver(room, victoryCheck.winner!, victoryCheck.message!);
    return;
  }

  if (killedHunter) {
    triggerHunterRevenge(room, killedHunter.playerId);
  } else {
    startDayPhase(room);
  }
}

// -----------------------------------------------------------------------------

// Trigger Hunter revenge shot
function triggerHunterRevenge(room: RoomData, hunterPlayerId: string) {
  if (!room.gameState) return;
  room.gameState.currentPhase = 'HUNTER_REVENGE';
  room.gameState.hunterMustShootPlayerId = hunterPlayerId;
  room.gameState.phaseDuration = 15;
  room.gameState.phaseEndsAt = Date.now() + 15000;

  const hunter = room.players.find((p) => p.id === hunterPlayerId);

  room.gameState.logs.push({
    id: `log_hunter_${Date.now()}`,
    round: room.gameState.roundNumber,
    phase: 'HUNTER_REVENGE',
    timestamp: Date.now(),
    message: `💥 Thợ Săn ${hunter?.nickname} trước khi nhắm mắt đã lên nòng súng săn!`,
    type: 'WARNING',
    isPublic: true,
  });

  broadcastRoom(room.id, 'PHASE_CHANGED', { newPhase: 'HUNTER_REVENGE' });

  // If hunter is bot, auto shoot
  if (hunter?.isBot) {
    setTimeout(() => {
      const living = room.players.filter((p) => p.isAlive && p.id !== hunter.id);
      if (living.length > 0) {
        const shotTarget = living[Math.floor(Math.random() * living.length)];
        shotTarget.isAlive = false;
        shotTarget.deathReason = 'Bị Thợ Săn bắn hạ';
        shotTarget.deathRound = room.gameState!.roundNumber;
        shotTarget.deathPhase = 'HUNTER';
        room.gameState?.lastNightVictims.push({
          playerId: shotTarget.id,
          playerName: shotTarget.nickname,
          roleName: ROLES_DATABASE[shotTarget.role!]?.vietnameseName,
          reason: 'Bị phát đạn giận dữ của Thợ Săn bắn gục',
        });
        startDeathRebuttal(room, [hunter.id, shotTarget.id]);
      } else {
        startDeathRebuttal(room, [hunter.id]);
      }
    }, 3000);
  } else {
    // Wait for Hunter action or timeout
    setTimeout(() => {
      if (room.gameState && room.gameState.currentPhase === 'HUNTER_REVENGE') {
        startDeathRebuttal(room, [hunterPlayerId]);
      }
    }, 15000);
  }
}

// Start Day Phase
function startDayPhase(room: RoomData) {
  if (!room.gameState) return;

  room.gameState.currentPhase = 'DAY_ANNOUNCEMENT';
  room.gameState.phaseDuration = 8; // 8s to read announcement
  room.gameState.phaseEndsAt = Date.now() + 8000;

  const victims = room.gameState.lastNightVictims;
  let morningLog = '';
  if (victims.length === 0) {
    morningLog = '☀️ Trời đã sáng! Đêm qua là một đêm bình yên kỳ lạ, không có bất kỳ ai thiệt mạng!';
  } else {
    const victimNames = victims.map((v) => v.playerName).join(', ');
    morningLog = `☀️ Bình minh hé rạng... Đêm qua làng đã mất đi: ${victimNames}!`;
  }

  room.gameState.logs.push({
    id: `log_morning_${room.gameState.roundNumber}_${Date.now()}`,
    round: room.gameState.roundNumber,
    phase: 'DAY_ANNOUNCEMENT',
    timestamp: Date.now(),
    message: morningLog,
    type: 'DEATH',
    isPublic: true,
  });

  broadcastRoom(room.id, 'PHASE_CHANGED', { newPhase: 'DAY_ANNOUNCEMENT' });

  // Transition to Discussion
  setTimeout(() => {
    if (!room.gameState) return;
    const discTime = room.settings.discussionTimeSeconds || 60;
    room.gameState.currentPhase = 'DAY_DISCUSSION';
    room.gameState.phaseDuration = discTime;
    room.gameState.phaseEndsAt = Date.now() + discTime * 1000;

    room.gameState.logs.push({
      id: `log_disc_${Date.now()}`,
      round: room.gameState.roundNumber,
      phase: 'DAY_DISCUSSION',
      timestamp: Date.now(),
      message: `🗣️ Hội nghị Làng bắt đầu! Người chơi còn sống có ${discTime} giây để tranh luận và tìm ra Ma Sói.`,
      type: 'INFO',
      isPublic: true,
    });

    broadcastRoom(room.id, 'PHASE_CHANGED', { newPhase: 'DAY_DISCUSSION' });

    // After discussion -> Start Voting
    setTimeout(() => {
      if (room.gameState && room.gameState.currentPhase === 'DAY_DISCUSSION') {
        startVotingPhase(room);
      }
    }, discTime * 1000);
  }, 8000);
}

// Start Voting Phase
function startVotingPhase(room: RoomData) {
  if (!room.gameState) return;

  const voteTime = room.settings.votingTimeSeconds || 30;
  room.gameState.currentPhase = 'VOTING';
  room.gameState.phaseDuration = voteTime;
  room.gameState.phaseEndsAt = Date.now() + voteTime * 1000;

  room.gameState.votingState = {
    votes: {},
    voteCounts: {},
    timeRemaining: voteTime,
    isLocked: false,
    isTie: false,
  };

  room.gameState.logs.push({
    id: `log_vote_start_${Date.now()}`,
    round: room.gameState.roundNumber,
    phase: 'VOTING',
    timestamp: Date.now(),
    message: '⚖️ Phiên Tòa Công Lý mở ra! Mỗi dân làng hãy bỏ phiếu bầu kẻ đáng bị treo cổ nhất.',
    type: 'VOTE',
    isPublic: true,
  });

  broadcastRoom(room.id, 'PHASE_CHANGED', { newPhase: 'VOTING' });

  // Simulate bot votes
  void simulateBotVotes(room);

  // Voting timeout -> Resolve votes
  setTimeout(() => {
    if (room.gameState && room.gameState.currentPhase === 'VOTING') {
      resolveVotes(room);
    }
  }, voteTime * 1000);
}

function simulateBotVotes(room: RoomData) {
  const vs = room.gameState?.votingState;
  if (!vs) return;

  const alivePlayers = room.players.filter((p) => p.isAlive);
  const aliveBots = alivePlayers.filter(
    (p) => p.isBot && p.botType !== 'GEMINI'
  );

  aliveBots.forEach((bot) => {
    const potentialTargets = alivePlayers.filter((p) => p.id !== bot.id);
    if (potentialTargets.length > 0) {
      const chosen = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
      vs.votes[bot.id] = chosen.id;
    }
  });

  void simulateSmartBotVotes(room);
}

async function simulateSmartBotVotes(room: RoomData) {
  const vs = room.gameState?.votingState;
  if (!vs) return;

  const smartBots = room.players.filter(
    (p) => p.isAlive && p.isBot && p.botType === 'GEMINI' && p.role
  );

  for (const bot of smartBots) {
    if (room.gameState?.currentPhase !== 'VOTING') return;
    const chosenId = await chooseBotVote(room, bot, roomChatMap);
    if (chosenId && room.gameState?.votingState && !room.gameState.votingState.isLocked) {
      room.gameState.votingState.votes[bot.id] = chosenId;
      broadcastRoom(room.id, 'VOTE_UPDATED');
    }
  }
}

// Resolve Daytime Voting
function resolveVotes(room: RoomData) {
  if (!room.gameState || !room.gameState.votingState) return;

  const vs = room.gameState.votingState;
  vs.isLocked = true;

  // Calculate vote counts with Mayor weighing 2x
  const counts: Record<string, number> = {};
  Object.entries(vs.votes).forEach(([voterId, targetId]) => {
    const voter = room.players.find((p) => p.id === voterId);
    if (voter && voter.isAlive) {
      const weight = voter.role === 'MAYOR' ? 2 : 1;
      counts[targetId] = (counts[targetId] || 0) + weight;
    }
  });
  vs.voteCounts = counts;

  let maxVotes = 0;
  let candidatesWithMax: string[] = [];

  Object.entries(counts).forEach(([targetId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      candidatesWithMax = [targetId];
    } else if (count === maxVotes) {
      candidatesWithMax.push(targetId);
    }
  });

  // Record the complete ballot only for the final post-game journal.
  Object.entries(vs.votes).forEach(([voterId, targetId]) => {
    const voter = room.players.find((p) => p.id === voterId);
    const target = room.players.find((p) => p.id === targetId);
    if (!voter || !target || !voter.isAlive) return;
    const weight = voter.role === 'MAYOR' ? 2 : 1;
    addGameJournal(
      room,
      'VOTING',
      `🗳️ ${voter.nickname} bỏ phiếu cho ${target.nickname}${weight === 2 ? ' (Thị Trưởng: 2 phiếu)' : ''}.`,
      'VOTE',
    );
  });

  let eliminatedPlayerId: string | undefined = undefined;

  if (candidatesWithMax.length === 1 && maxVotes > 0) {
    eliminatedPlayerId = candidatesWithMax[0];
  } else if (candidatesWithMax.length > 1) {
    vs.isTie = true;
    if (room.settings.tieHandling === 'MAYOR_DECIDES') {
      // Find Mayor vote
      const mayor = room.players.find((p) => p.role === 'MAYOR' && p.isAlive);
      if (mayor && vs.votes[mayor.id] && candidatesWithMax.includes(vs.votes[mayor.id])) {
        eliminatedPlayerId = vs.votes[mayor.id];
      }
    }
  }

  const voteSummary = Object.entries(counts)
    .map(([targetId, count]) => `${room.players.find((p) => p.id === targetId)?.nickname || targetId}: ${count} phiếu`)
    .join(' • ');
  addGameJournal(
    room,
    'VOTE_RESOLUTION',
    `📊 Kết quả biểu quyết vòng ${room.gameState.roundNumber}: ${voteSummary || 'Không có phiếu hợp lệ'}.`,
    'VOTE',
  );

  if (eliminatedPlayerId) {
    const target = room.players.find((p) => p.id === eliminatedPlayerId);
    if (target) {
      target.isAlive = false;
      target.deathReason = 'Bị dân làng treo cổ';
      target.deathRound = room.gameState.roundNumber;
      target.deathPhase = 'DAY';

      room.gameState.lastDayEliminated = {
        playerId: target.id,
        playerName: target.nickname,
        roleName: ROLES_DATABASE[target.role!]?.vietnameseName,
        votesReceived: maxVotes,
      };

      addGameJournal(
        room,
        'VOTE_RESOLUTION',
        `🪢 ${target.nickname} bị loại với ${maxVotes} phiếu. Vai trò: ${ROLES_DATABASE[target.role!]?.vietnameseName || 'Ẩn'}.`,
        'DEATH',
      );

      room.gameState.logs.push({
        id: `log_elim_${Date.now()}`,
        round: room.gameState.roundNumber,
        phase: 'VOTE_RESOLUTION',
        timestamp: Date.now(),
        message: `🪢 Dân làng đã biểu quyết xử tử ${target.nickname} (${maxVotes} phiếu) trên giàn treo cổ!`,
        type: 'DEATH',
        isPublic: true,
      });

      // Special Jester condition: If Jester was lynched, Jester wins instantly!
      if (target.role === 'JESTER') {
        triggerGameOver(room, 'JESTER', `Kẻ Hề ${target.nickname} đã hoàn thành tâm nguyện bị treo cổ và giành CHIẾN THẮNG SOLO!`);
        return;
      }

      // If Hunter was lynched -> Trigger Hunter revenge
      if (target.role === 'HUNTER') {
        broadcastRoom(room.id, 'PHASE_CHANGED', { newPhase: 'VOTE_RESOLUTION' });
        setTimeout(() => {
          triggerHunterRevenge(room, target.id);
        }, 5000);
        return;
      }
    }
  } else {
    room.gameState.lastDayEliminated = undefined;
    addGameJournal(
      room,
      'VOTE_RESOLUTION',
      `⚖️ Vòng ${room.gameState.roundNumber} hòa phiếu, không có ai bị loại.`,
      'VOTE',
    );
    room.gameState.logs.push({
      id: `log_tie_${Date.now()}`,
      round: room.gameState.roundNumber,
      phase: 'VOTE_RESOLUTION',
      timestamp: Date.now(),
      message: '⚖️ Số phiếu biểu quyết bị hòa! Không có ai bị xử tử trong phiên tòa hôm nay.',
      type: 'INFO',
      isPublic: true,
    });
  }

  broadcastRoom(room.id, 'PHASE_CHANGED', { newPhase: 'VOTE_RESOLUTION' });

  // Check victory after vote
  const victoryCheck = checkVictory(room);
  if (victoryCheck.gameOver) {
    setTimeout(() => {
      triggerGameOver(room, victoryCheck.winner!, victoryCheck.message!);
    }, 5000);
    return;
  }

  // Người bị treo cổ được 30s phản biện trước khi bước sang đêm mới.
  if (eliminatedPlayerId) {
    if (startDeathRebuttal(room, [eliminatedPlayerId])) return;
  }

  // Không có người chết: chuyển thẳng sang đêm mới.
  setTimeout(() => {
    if (!room.gameState) return;
    room.gameState.roundNumber += 1;
    startNightPhase(room);
  }, 1000);
}

// Trigger Game Over & Reveal
function triggerGameOver(room: RoomData, winner: any, message: string) {
  if (!room.gameState) return;

  room.gameState.currentPhase = 'GAME_OVER';
  room.gameState.winnerTeam = winner;
  room.gameState.winnerMessage = message;
  room.status = 'FINISHED';

  addGameJournal(
    room,
    'GAME_OVER',
    `🏆 KẾT THÚC VÁN ĐẤU — ${message}`,
    'VICTORY',
  );

  room.players.forEach((p) => {
    addGameJournal(
      room,
      'GAME_OVER',
      `${p.isAlive ? '✨ Sống sót' : '💀 Đã chết'} — ${p.nickname}: ${ROLES_DATABASE[p.role!]?.vietnameseName || 'Không rõ vai trò'}${p.deathReason ? ` — ${p.deathReason}` : ''}.`,
      p.isAlive ? 'INFO' : 'DEATH',
    );
  });

  room.gameState.logs.push({
    id: `log_gameover_${Date.now()}`,
    round: room.gameState.roundNumber,
    phase: 'GAME_OVER',
    timestamp: Date.now(),
    message: `🏆 KẾT THÚC TRẬN ĐẤU! ${message}`,
    type: 'VICTORY',
    isPublic: true,
  });

  broadcastRoom(room.id, 'PHASE_CHANGED', { newPhase: 'GAME_OVER' });
}

// ----------------------------------------------------------------------------
// WEBSOCKET SIGNALING & PROTOCOL HUB
// ----------------------------------------------------------------------------

wss.on('connection', (ws: WebSocket, req) => {
  ws.on('message', (messageRaw: string) => {
    try {
      const data: WsMessagePayload = JSON.parse(messageRaw.toString());
      const { type, roomId, playerId, payload } = data;

      switch (type) {
        case 'AUTH': {
          if (!playerId || !roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;

          if (!playerSockets.has(playerId)) {
            playerSockets.set(playerId, new Set());
          }
          playerSockets.get(playerId)!.add(ws);
          socketPlayerMap.set(ws, { playerId, roomId });

          // Update player online status
          const p = room.players.find((x) => x.id === playerId);
          if (p) {
            p.socketConnected = true;
            p.lastActive = Date.now();
          }

          ws.send(
            JSON.stringify({
              type: 'AUTH_SUCCESS',
              payload: { playerId, sessionToken: `session_${playerId}` },
            })
          );

          broadcastRoom(roomId, 'ROOM_STATE');
          break;
        }

        case 'RECONNECT_REQUEST': {
          if (!playerId || !roomId) return;
          const room = rooms.get(roomId);
          if (!room) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Phòng không còn tồn tại hoặc đã bị hủy.' } }));
            return;
          }

          const player = room.players.find((p) => p.id === playerId);
          if (!player) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Không tìm thấy thông tin người chơi trong phòng.' } }));
            return;
          }

          if (!playerSockets.has(playerId)) {
            playerSockets.set(playerId, new Set());
          }
          playerSockets.get(playerId)!.add(ws);
          socketPlayerMap.set(ws, { playerId, roomId });

          player.socketConnected = true;
          player.lastActive = Date.now();

          // Send sanitized current room state to reconnecting client
          const sanitizedRoom = getSanitizedRoomForPlayer(room, playerId);
          ws.send(
            JSON.stringify({
              type: 'RECONNECT_STATE',
              payload: { room: sanitizedRoom },
            })
          );
          break;
        }

        case 'DECK_UPDATED': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room || room.hostPlayerId !== playerId || room.status !== 'WAITING') return;

          if (Array.isArray(payload?.deck)) {
            room.deck = payload.deck;
            broadcastRoom(roomId, 'ROOM_STATE');
          }
          break;
        }

        case 'SETTINGS_UPDATED': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room || room.hostPlayerId !== playerId || room.status !== 'WAITING') return;

          if (payload?.settings) {
            room.settings = { ...room.settings, ...payload.settings };
            broadcastRoom(roomId, 'ROOM_STATE');
          }
          break;
        }

        case 'GAME_START_REQUEST': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room || room.hostPlayerId !== playerId) return;

          if (room.players.length < 6) {
            sendToPlayer(playerId, 'ERROR', { message: 'Cần tối thiểu 6 người chơi để bắt đầu trận đấu Ma Sói.' });
            return;
          }

          try {
            startGame(room);
          } catch (err: any) {
            sendToPlayer(playerId, 'ERROR', { message: err.message || 'Lỗi cấu hình bộ bài.' });
          }
          break;
        }

        case 'ACTION_SUBMIT': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room || !room.gameState) return;

          const action: GameAction = payload;
          if (room.gameState.currentPhase === 'HUNTER_REVENGE') {
            handleHunterRevengeAction(room, playerId, action);
          } else if (room.gameState.currentPhase === 'NIGHT') {
            handleNightAction(room, playerId, action);
          }
          break;
        }

        case 'VOTE_SUBMIT': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room || !room.gameState || room.gameState.currentPhase !== 'VOTING') return;

          const player = room.players.find((p) => p.id === playerId);
          if (!player || !player.isAlive) return;

          const targetPlayerId = payload?.targetPlayerId;
          const vs = room.gameState.votingState;
          if (vs && !vs.isLocked && targetPlayerId) {
            vs.votes[player.id] = targetPlayerId;
            broadcastRoom(roomId, 'ROOM_STATE');
          }
          break;
        }

        case 'CHAT_MESSAGE': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room) return;

          const player = room.players.find((p) => p.id === playerId);
          if (!player) return;

          const text = payload?.text?.trim();
          const channel = payload?.channel || 'LOBBY';
          if (!text) return;

          // Block silenced players from chatting in public Day / Lobby channel during active game
          if (player.isSilenced && (channel === 'DAY_PUBLIC' || channel === 'LOBBY') && room.gameState?.currentPhase !== 'LOBBY') {
            sendToPlayer(playerId, 'ERROR', { message: '🤐 Bạn đang bị Nữ Thần Liễu phong ấn câm lặng! Không thể gửi tin nhắn trong suốt ngày hôm nay.' });
            return;
          }

          // Người chết chỉ được chat chung trong 30s phản biện của chính mình.
          if (!player.isAlive && channel === 'DAY_PUBLIC') {
            const rebuttalAllowed =
              room.gameState?.currentPhase === 'DEATH_REBUTTAL' &&
              room.gameState.deathRebuttalPlayerIds?.includes(player.id);
            if (!rebuttalAllowed) {
              sendToPlayer(playerId, 'ERROR', { message: 'Linh hồn đã chết chỉ có thể nhắn tin trong Cõi Âm, trừ 30 giây phản biện sau khi bị xử tử.' });
              return;
            }
          }

          const chatMsg: ChatMessage = {
            id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            senderId: player.id,
            senderName: player.nickname,
            avatarSeed: player.avatarSeed,
            text,
            timestamp: Date.now(),
            channel,
          };

          const roomChats = roomChatMap.get(roomId) || [];
          roomChats.push(chatMsg);
          roomChatMap.set(roomId, roomChats.slice(-100));

          // Broadcast chat to authorized recipients
          room.players.forEach((p) => {
            let canReceive = false;
            if (channel === 'LOBBY' || channel === 'DAY_PUBLIC') {
              canReceive = true;
            } else if (channel === 'GHOST_PRIVATE' && !p.isAlive) {
              canReceive = true;
            } else if (channel === 'WOLF_PRIVATE' && p.role && ROLES_DATABASE[p.role]?.team === 'WEREWOLF') {
              canReceive = true;
            }

            if (canReceive) {
              sendToPlayer(p.id, 'NEW_CHAT', { message: chatMsg });
            }
          });

          // One Gemini-powered bot can participate in the public room chat.
          if (channel === 'LOBBY' || channel === 'DAY_PUBLIC') {
            const smartBots = room.players.filter(
              (p) => p.isBot && p.botType === 'GEMINI' && p.id !== player.id
            );
            smartBots.forEach((bot) => {
              void maybeBotReplyToChat(room, bot, roomChatMap, channel, (botMessage) => {
                const chats = roomChatMap.get(roomId) || [];
                chats.push(botMessage);
                roomChatMap.set(roomId, chats.slice(-100));
                room.players.forEach((recipient) => {
                  sendToPlayer(recipient.id, 'NEW_CHAT', { message: botMessage });
                });
              });
            });
          }
          break;
        }

        case 'VOICE_STATUS_UPDATE': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room) return;

          const player = room.players.find((p) => p.id === playerId);
          if (!player) return;

          const isMutedReq = !!payload?.isMuted;
          const isSpeakingReq = !!payload?.isSpeaking;
          const isDeafenedReq = !!payload?.isDeafened;

          const currentPhase = room.gameState?.currentPhase;
          const nightStep = room.gameState?.nightState?.currentStep;
          const isWolfDiscussion =
            currentPhase === 'NIGHT' &&
            nightStep === 'WEREWOLF_HUNT' &&
            !!player.role &&
            ROLES_DATABASE[player.role]?.team === 'WEREWOLF' &&
            player.isAlive;

          let effectiveMuted = isMutedReq;
          let effectiveSpeaking = isSpeakingReq;
          let effectiveDeafened = isDeafenedReq;

          // Night rule: only living werewolves may use voice during the wolf
          // discussion. Everyone else is muted and cannot listen.
          if (
            currentPhase === 'NIGHT' ||
            currentPhase === 'ROLE_REVEAL' ||
            currentPhase === 'HUNTER_REVENGE'
          ) {
            if (!isWolfDiscussion) {
              effectiveMuted = true;
              effectiveSpeaking = false;
              if (currentPhase === 'NIGHT') effectiveDeafened = true;
            } else {
              // Wolves may choose to deafen themselves, but are never forced
              // muted during their 45-second discussion.
              effectiveMuted = isMutedReq;
              effectiveSpeaking = effectiveMuted ? false : isSpeakingReq;
              effectiveDeafened = isDeafenedReq;
            }
          }

          if (!room.voiceStates) room.voiceStates = {};
          room.voiceStates[playerId] = {
            playerId,
            nickname: player.nickname,
            isMuted: effectiveMuted,
            isSpeaking: effectiveMuted ? false : effectiveSpeaking,
            isDeafened: effectiveDeafened,
            isSilenced: player.isSilenced,
          };

          broadcastRoom(roomId, 'VOICE_STATUS_UPDATE', {
            voiceStates: room.voiceStates,
          });
          break;
        }

        case 'VOICE_SIGNAL': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room) return;

          const currentPhase = room.gameState?.currentPhase;
          const nightStep = room.gameState?.nightState?.currentStep;
          const player = room.players.find((p) => p.id === playerId);
          if (!player) return;

          const isWolfDiscussion =
            currentPhase === 'NIGHT' &&
            nightStep === 'WEREWOLF_HUNT' &&
            !!player.role &&
            ROLES_DATABASE[player.role]?.team === 'WEREWOLF' &&
            player.isAlive;

          if (
            (currentPhase === 'NIGHT' && !isWolfDiscussion) ||
            currentPhase === 'ROLE_REVEAL' ||
            currentPhase === 'HUNTER_REVENGE'
          ) return;

          if (player?.isSilenced && currentPhase !== 'LOBBY') return; // Drop audio if silenced

          const targetPlayerId = payload?.targetPlayerId;
          if (targetPlayerId) {
            sendToPlayer(targetPlayerId, 'VOICE_SIGNAL', {
              fromPlayerId: playerId,
              signal: payload?.signal,
            });
          } else {
            // Broadcast signal to other peers
            room.players.forEach((p) => {
              if (p.id !== playerId) {
                sendToPlayer(p.id, 'VOICE_SIGNAL', {
                  fromPlayerId: playerId,
                  signal: payload?.signal,
                });
              }
            });
          }
          break;
        }

        case 'HOST_TRANSFER_REQUEST': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room || room.hostPlayerId !== playerId) return;

          const targetPlayerId = payload?.targetPlayerId;
          const targetPlayer = room.players.find((p) => p.id === targetPlayerId);
          const currentHost = room.players.find((p) => p.id === playerId);

          if (targetPlayer && currentHost) {
            const transferReq: HostTransferRequest = {
              fromPlayerId: currentHost.id,
              fromPlayerName: currentHost.nickname,
              toPlayerId: targetPlayer.id,
              toPlayerName: targetPlayer.nickname,
              expiresAt: Date.now() + 30000, // 30s countdown
            };
            room.hostTransferRequest = transferReq;
            broadcastRoom(roomId, 'ROOM_STATE');

            // Timeout after 30s
            setTimeout(() => {
              if (room.hostTransferRequest && room.hostTransferRequest.expiresAt <= Date.now() + 1000) {
                room.hostTransferRequest = undefined;
                broadcastRoom(roomId, 'ROOM_STATE');
              }
            }, 30000);
          }
          break;
        }

        case 'HOST_TRANSFER_RESPOND': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room || !room.hostTransferRequest || room.hostTransferRequest.toPlayerId !== playerId) return;

          const accept = !!payload?.accept;
          if (accept) {
            room.hostPlayerId = playerId;
            room.players.forEach((p) => {
              p.isHost = p.id === playerId;
            });
            room.gameState?.logs.push({
              id: `log_host_${Date.now()}`,
              round: room.gameState.roundNumber,
              phase: room.gameState.currentPhase,
              timestamp: Date.now(),
              message: `👑 Quyền Quản Trò đã được trao lại cho ${room.hostTransferRequest.toPlayerName}!`,
              type: 'INFO',
              isPublic: true,
            });
          }
          room.hostTransferRequest = undefined;
          broadcastRoom(roomId, 'ROOM_STATE');
          break;
        }

        case 'ADD_BOT_REQUEST': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room || room.hostPlayerId !== playerId || room.status !== 'WAITING') return;

          if (room.players.length >= room.settings.maxPlayers) {
            sendToPlayer(playerId, 'ERROR', { message: 'Phòng chơi đã đạt tối đa số người.' });
            return;
          }

          const botNames = ['Hùng Sát Thủ', 'Minh Tiên Tri', 'Thu Trang', 'Linh Đan', 'Quân Android', 'Bảo Hộ', 'Lan Anh', 'Vũ Sói'];
          const availableNames = botNames.filter((name) => !room.players.some((p) => p.nickname === name));
          const botNickname = availableNames.length > 0 ? availableNames[0] : `Người máy #${room.players.length + 1}`;

          const botPlayer: Player = {
            id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            nickname: botNickname,
            avatarSeed: `bot_${botNickname}`,
            isHost: false,
            isAlive: true,
            isReady: true,
            isBot: true,
            botType: 'LEGACY',
            socketConnected: true,
            lastActive: Date.now(),
          };

          room.players.push(botPlayer);

          // Update deck card count to match players
          if (room.deck.length > 0) {
            const autoDeck = getAutoDeckForPlayerCount(room.players.length);
            if (autoDeck) {
              room.deck = autoDeck;
            }
          }

          broadcastRoom(roomId, 'ROOM_STATE');
          break;
        }

        case 'ADD_SMART_BOT_REQUEST': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room || room.hostPlayerId !== playerId || room.status !== 'WAITING') return;

          if (room.players.length >= room.settings.maxPlayers) {
            sendToPlayer(playerId, 'ERROR', { message: 'Phòng chơi đã đạt tối đa số người.' });
            return;
          }

          const smartBotCount = room.players.filter(
            (p) => p.isBot && p.botType === 'GEMINI'
          ).length;

          if (smartBotCount >= MAX_SMART_BOTS_PER_ROOM) {
            sendToPlayer(playerId, 'ERROR', {
              message: 'Phòng hiện chỉ cho phép 1 Bot Gemini thông minh. Giới hạn này có thể mở rộng trong phiên bản sau.',
            });
            return;
          }

          const smartBotNames = ['Linh AI'];
          const availableName = smartBotNames.find(
            (name) => !room.players.some((p) => p.nickname === name)
          );
          const botNickname = availableName || `Gemini Bot #${smartBotCount + 1}`;

          const botPlayer: Player = {
            id: `gemini_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            nickname: botNickname,
            avatarSeed: 'bot_Linh_AI',
            isHost: false,
            isAlive: true,
            isReady: true,
            isBot: true,
            botType: 'GEMINI',
            botProfileId: 'LINH',
            socketConnected: true,
            lastActive: Date.now(),
          };

          room.players.push(botPlayer);

          if (room.deck.length > 0) {
            const autoDeck = getAutoDeckForPlayerCount(room.players.length);
            if (autoDeck) room.deck = autoDeck;
          }

          broadcastRoom(roomId, 'ROOM_STATE');
          break;
        }

        case 'KICK_PLAYER_REQUEST': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room || room.hostPlayerId !== playerId || room.status !== 'WAITING') return;

          const targetPlayerId = payload?.targetPlayerId;
          if (targetPlayerId && targetPlayerId !== playerId) {
            room.players = room.players.filter((p) => p.id !== targetPlayerId);

            // Re-scale deck to the new player count so the room stays startable
            if (room.deck.length > 0) {
              const autoDeck = getAutoDeckForPlayerCount(room.players.length);
              if (autoDeck) {
                room.deck = autoDeck;
              }
            }

            broadcastRoom(roomId, 'ROOM_STATE');
          }
          break;
        }

        case 'RETURN_TO_LOBBY': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room || room.hostPlayerId !== playerId) return;

          room.status = 'WAITING';
          room.gameState = undefined;
          room.players.forEach((p) => {
            p.isAlive = true;
            p.role = undefined;
            p.deathReason = undefined;
          });

          broadcastRoom(roomId, 'ROOM_STATE');
          break;
        }

        case 'PLAYER_LEFT': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room) return;

          room.players = room.players.filter((p) => p.id !== playerId);

          // Re-scale deck to the new player count so the room stays startable
          if (room.players.length > 0 && room.status === 'WAITING' && room.deck.length > 0) {
            const autoDeck = getAutoDeckForPlayerCount(room.players.length);
            if (autoDeck) {
              room.deck = autoDeck;
            }
          }

          if (room.players.length === 0) {
            rooms.delete(roomId);
          } else if (room.hostPlayerId === playerId) {
            // Reassign host
            room.hostPlayerId = room.players[0].id;
            room.players[0].isHost = true;
            broadcastRoom(roomId, 'ROOM_STATE');
          } else {
            broadcastRoom(roomId, 'ROOM_STATE');
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('WS Error:', err);
    }
  });

  ws.on('close', () => {
    const meta = socketPlayerMap.get(ws);
    if (meta) {
      const { playerId, roomId } = meta;
      const sockets = playerSockets.get(playerId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          playerSockets.delete(playerId);
          const room = rooms.get(roomId);
          if (room) {
            const p = room.players.find((x) => x.id === playerId);
            if (p) p.socketConnected = false;
            broadcastRoom(roomId, 'ROOM_STATE');
          }
        }
      }
      socketPlayerMap.delete(ws);
    }
  });
});

// ----------------------------------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// LiveKit Token API
// ----------------------------------------------------------------------------

app.post('/api/livekit/token', async (req: Request, res: Response) => {
  try {
    const { roomName, identity } = req.body;

    if (!roomName || !identity) {
      return res.status(400).json({
        error: 'roomName và identity là bắt buộc.',
      });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('[LIVEKIT] Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET');
      return res.status(500).json({
        error: 'LiveKit server configuration is missing.',
      });
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: String(identity),
      ttl: '1h',
    });

    token.addGrant({
      roomJoin: true,
      room: String(roomName),
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();

    return res.json({
      token: jwt,
    });
  } catch (error) {
    console.error('[LIVEKIT] Token generation error:', error);

    return res.status(500).json({
      error: 'Không thể tạo LiveKit token.',
    });
  }
});
// 1. Create Room
app.post('/api/room/create', (req: Request, res: Response) => {
  const { nickname, settings } = req.body;
  if (!nickname || nickname.trim().length === 0) {
    return res.status(400).json({ error: 'Vui lòng nhập Biệt danh hợp lệ (1-16 ký tự).' });
  }

  const roomId = `room_${Date.now()}`;
  const code = generateRoomCode();
  const hostPlayerId = `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const sessionToken = `session_${hostPlayerId}`;

  const hostPlayer: Player = {
    id: hostPlayerId,
    nickname: nickname.trim().substring(0, 16),
    avatarSeed: hostPlayerId,
    isHost: true,
    isAlive: true,
    isReady: true,
    socketConnected: true,
    lastActive: Date.now(),
  };

  const defaultDeck = DECK_PRESETS[0].deck;

  const newRoom: RoomData = {
    id: roomId,
    code,
    hostPlayerId,
    players: [hostPlayer],
    status: 'WAITING',
    settings: { ...DEFAULT_SETTINGS, ...settings },
    deck: defaultDeck,
    createdAt: Date.now(),
    isLocked: false,
  };

  rooms.set(roomId, newRoom);

  res.json({
    roomId,
    code,
    playerId: hostPlayerId,
    sessionToken,
    room: newRoom,
  });
});

// 2. Join Room
app.post('/api/room/join', (req: Request, res: Response) => {
  const { code, nickname } = req.body;
  if (!code || !nickname || nickname.trim().length === 0) {
    return res.status(400).json({ error: 'Mã phòng và Biệt danh không được để trống.' });
  }

  const cleanCode = code.trim().toUpperCase();
  let foundRoom: RoomData | undefined = undefined;

  for (const [, r] of rooms) {
    if (r.code === cleanCode) {
      foundRoom = r;
      break;
    }
  }

  if (!foundRoom) {
    return res.status(404).json({ error: 'Phòng không tồn tại hoặc đã kết thúc.' });
  }

  if (foundRoom.status === 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Trận đấu trong phòng này đã bắt đầu.' });
  }

  if (foundRoom.players.length >= foundRoom.settings.maxPlayers) {
    return res.status(400).json({ error: 'Phòng đã đủ số lượng người chơi tối đa.' });
  }

  const cleanName = nickname.trim().substring(0, 16);
  if (foundRoom.players.some((p) => p.nickname.toLowerCase() === cleanName.toLowerCase())) {
    return res.status(400).json({ error: 'Biệt danh này đã có người sử dụng trong phòng.' });
  }

  const newPlayerId = `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const sessionToken = `session_${newPlayerId}`;

  const newPlayer: Player = {
    id: newPlayerId,
    nickname: cleanName,
    avatarSeed: newPlayerId,
    isHost: false,
    isAlive: true,
    isReady: true,
    socketConnected: true,
    lastActive: Date.now(),
  };

  foundRoom.players.push(newPlayer);

  // Auto update deck to match player count if using preset
  const autoDeck = getAutoDeckForPlayerCount(foundRoom.players.length);
  if (autoDeck) {
    foundRoom.deck = autoDeck;
  }

  broadcastRoom(foundRoom.id, 'ROOM_STATE');

  res.json({
    roomId: foundRoom.id,
    code: foundRoom.code,
    playerId: newPlayerId,
    sessionToken,
    room: getSanitizedRoomForPlayer(foundRoom, newPlayerId),
  });
});

// 3. Get Roles List
app.get('/api/roles', (_req: Request, res: Response) => {
  res.json({ roles: Object.values(ROLES_DATABASE) });
});

// 4. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', activeRooms: rooms.size, serverTime: Date.now() });
});

// ----------------------------------------------------------------------------
// VITE MIDDLEWARE & SERVER STARTUP
// ----------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist', 'client');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🐺 WEREWOLF Authoritative Server running on port ${PORT}`);
  });
}

startServer();