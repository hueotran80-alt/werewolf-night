import express, { Request, Response } from 'express';
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
import { ROLES_DATABASE, DECK_PRESETS } from './src/data/rolesData';

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

  // Sanitize players: only reveal role if it's the player themselves, or if dead & revealRoleOnDeath, or if both are wolves, or game over
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
      // Werewolves can see teammates
      roleToReveal = p.role;
    }

    return {
      ...p,
      role: roleToReveal,
    };
  });

  return {
    ...room,
    players: sanitizedPlayers,
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
  if (mode === 'THREE_TEAM' && playerCount < 9) {
    return { valid: false, error: 'Chế độ 3 Phe (có vai trò Độc Lập) yêu cầu tối thiểu từ 9 người chơi trở lên.' };
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

// Start Night Phase
function startNightPhase(room: RoomData) {
  if (!room.gameState) return;

  // IMPORTANT: witchHasHeal / witchHasPoison / lastGuardedPlayerId must persist
  // across the whole game (each potion is usable exactly ONCE per match), so we
  // carry them over from the previous night instead of resetting every night.
  const prevNightState = room.gameState.nightState;

  room.gameState.currentPhase = 'NIGHT';
  room.gameState.phaseDuration = 35; // 35s night duration
  room.gameState.phaseEndsAt = Date.now() + 35000;

  room.gameState.nightState = {
    currentStep: 'WEREWOLF_HUNT',
    stepTimeRemaining: 35,
    werewolfVotes: {},
    witchSaved: false,
    witchHasHeal: prevNightState ? prevNightState.witchHasHeal : true,
    witchHasPoison: prevNightState ? prevNightState.witchHasPoison : true,
    lastGuardedPlayerId: prevNightState?.lastGuardedPlayerId,
    nightVictims: [],
  };

  // Force mute all mics when night falls
  if (room.voiceStates) {
    Object.values(room.voiceStates).forEach((vs) => {
      vs.isMuted = true;
      vs.isSpeaking = false;
    });
  }

  room.gameState.logs.push({
    id: `log_night_${room.gameState.roundNumber}_${Date.now()}`,
    round: room.gameState.roundNumber,
    phase: 'NIGHT',
    timestamp: Date.now(),
    message: `🌙 Đêm thứ ${room.gameState.roundNumber} buông xuống... Toàn bộ mic tự động tắt! Ngôi làng chìm vào giấc ngủ u tối.`,
    type: 'INFO',
    isPublic: true,
  });

  broadcastRoom(room.id, 'PHASE_CHANGED', { newPhase: 'NIGHT' });
  broadcastRoom(room.id, 'VOICE_FORCE_MUTE_ALL');

  // Auto trigger Bot Actions during Night
  simulateBotNightActions(room);

  // Night Timer Loop -> Resolve Night
  setTimeout(() => {
    if (room.gameState && room.gameState.currentPhase === 'NIGHT') {
      resolveNightActions(room);
    }
  }, 35000);
}

// Simulate Bot night decisions for quick testing
function simulateBotNightActions(room: RoomData) {
  const ns = room.gameState?.nightState;
  if (!ns) return;

  const alivePlayers = room.players.filter((p) => p.isAlive);
  const aliveBots = alivePlayers.filter((p) => p.isBot);

  // Process Werewolf-team bots first so other roles (e.g. Witch) can react
  // to a known werewolf target instead of an undecided one.
  const sortedBots = [...aliveBots].sort((a, b) => {
    const aIsWolf = a.role ? ROLES_DATABASE[a.role].team === 'WEREWOLF' : false;
    const bIsWolf = b.role ? ROLES_DATABASE[b.role].team === 'WEREWOLF' : false;
    return aIsWolf === bIsWolf ? 0 : aIsWolf ? -1 : 1;
  });

  sortedBots.forEach((bot) => {
    const role = bot.role;
    if (!role) return;

    if (ROLES_DATABASE[role].team === 'WEREWOLF') {
      // Pick a random non-wolf target
      const targets = alivePlayers.filter((p) => p.role && ROLES_DATABASE[p.role].team !== 'WEREWOLF');
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        ns.werewolfVotes[bot.id] = target.id;
        ns.werewolfTarget = target.id;
      }
    } else if (role === 'SEER') {
      const targets = alivePlayers.filter((p) => p.id !== bot.id);
      if (targets.length > 0) {
        ns.seerTarget = targets[Math.floor(Math.random() * targets.length)].id;
      }
    } else if (role === 'BODYGUARD') {
      const targets = alivePlayers.filter((p) => p.id !== ns.lastGuardedPlayerId);
      if (targets.length > 0) {
        ns.bodyguardTarget = targets[Math.floor(Math.random() * targets.length)].id;
      }
    } else if (role === 'SERIAL_KILLER') {
      const targets = alivePlayers.filter((p) => p.id !== bot.id);
      if (targets.length > 0) {
        ns.serialKillerTarget = targets[Math.floor(Math.random() * targets.length)].id;
      }
    } else if (role === 'LIEU') {
      const targets = alivePlayers.filter((p) => p.id !== bot.id);
      if (targets.length > 0) {
        ns.lieuTarget = targets[Math.floor(Math.random() * targets.length)].id;
      }
    } else if (role === 'WITCH') {
      // Bot Witch: decide whether to save the werewolves' victim, and whether to poison someone
      if (ns.witchHasHeal && ns.werewolfTarget) {
        // ~65% chance to use the Cứu Sinh potion when a victim is already known
        if (Math.random() < 0.65) {
          ns.witchSaved = true;
          ns.witchHasHeal = false;
        }
      }

      if (ns.witchHasPoison) {
        // ~30% chance to use the Độc Dược potion on a random suspect (never on the werewolf victim already dying)
        if (Math.random() < 0.3) {
          const poisonTargets = alivePlayers.filter(
            (p) => p.id !== bot.id && p.id !== ns.werewolfTarget
          );
          if (poisonTargets.length > 0) {
            const poisoned = poisonTargets[Math.floor(Math.random() * poisonTargets.length)];
            ns.witchPoisonTarget = poisoned.id;
            ns.witchHasPoison = false;
          }
        }
      }
    }
  });
}

// Resolve Night Actions according to Authoritative Priority Engine
function resolveNightActions(room: RoomData) {
  if (!room.gameState || !room.gameState.nightState) return;

  const ns = room.gameState.nightState;
  const victims: { playerId: string; playerName: string; roleName?: string; reason: string }[] = [];

  // 1. Werewolf consensus target
  let wolfKillTargetId: string | undefined = undefined;
  const wolfVoteCounts: Record<string, number> = {};

  Object.entries(ns.werewolfVotes).forEach(([wolfId, targetId]) => {
    const wolfPlayer = room.players.find((p) => p.id === wolfId);
    const weight = wolfPlayer?.role === 'ALPHA_WOLF' ? 2 : 1;
    wolfVoteCounts[targetId] = (wolfVoteCounts[targetId] || 0) + weight;
  });

  let maxVotes = 0;
  Object.entries(wolfVoteCounts).forEach(([targetId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      wolfKillTargetId = targetId;
    }
  });

  // Check Bodyguard protection
  const isProtectedByBodyguard = (targetId: string) => ns.bodyguardTarget === targetId;

  // Process Wolf Kill
  if (wolfKillTargetId) {
    const targetPlayer = room.players.find((p) => p.id === wolfKillTargetId);
    if (targetPlayer && targetPlayer.isAlive) {
      if (targetPlayer.role === 'SERIAL_KILLER') {
        // Serial killer is immune to wolf attack
        room.gameState.logs.push({
          id: `log_immune_${Date.now()}`,
          round: room.gameState.roundNumber,
          phase: 'NIGHT',
          timestamp: Date.now(),
          message: 'Ma Sói đã tấn công nhưng mục tiêu có lớp giáp bí ẩn không thể xuyên thủng!',
          type: 'INFO',
          isPublic: false,
        });
      } else if (isProtectedByBodyguard(wolfKillTargetId)) {
        // Protected by bodyguard
        room.gameState.logs.push({
          id: `log_bg_${Date.now()}`,
          round: room.gameState.roundNumber,
          phase: 'NIGHT',
          timestamp: Date.now(),
          message: 'Bảo Vệ đã bảo vệ thành công một nạn nhân khỏi nanh vuốt Ma Sói!',
          type: 'INFO',
          isPublic: false,
        });
      } else if (ns.witchSaved && ns.werewolfTarget === wolfKillTargetId) {
        // Saved by Witch Potion
        room.gameState.logs.push({
          id: `log_witch_save_${Date.now()}`,
          round: room.gameState.roundNumber,
          phase: 'NIGHT',
          timestamp: Date.now(),
          message: 'Phù Thủy đã kịp thời rót Thuốc Cứu Sinh giải thoát nạn nhân khỏi tay tử thần!',
          type: 'INFO',
          isPublic: false,
        });
      } else if (targetPlayer.role === 'ELDER' && (targetPlayer.protectedCount || 0) === 0) {
        // Elder first life absorbed
        targetPlayer.protectedCount = 1;
        room.gameState.logs.push({
          id: `log_elder_${Date.now()}`,
          round: room.gameState.roundNumber,
          phase: 'NIGHT',
          timestamp: Date.now(),
          message: 'Già Làng đã chống chọi kiên cường và thoát chết trong gang tấc nhờ sinh lực dẻo dai!',
          type: 'INFO',
          isPublic: false,
        });
      } else {
        // Victim dies
        targetPlayer.isAlive = false;
        targetPlayer.deathReason = 'Bị Ma Sói cắn xé';
        targetPlayer.deathRound = room.gameState.roundNumber;
        targetPlayer.deathPhase = 'NIGHT';
        victims.push({
          playerId: targetPlayer.id,
          playerName: targetPlayer.nickname,
          roleName: ROLES_DATABASE[targetPlayer.role!]?.vietnameseName,
          reason: 'Bị Ma Sói cắn xé trong đêm',
        });
      }
    }
  }

  // 2. Process Witch Poison
  if (ns.witchPoisonTarget) {
    const poisonTarget = room.players.find((p) => p.id === ns.witchPoisonTarget);
    if (poisonTarget && poisonTarget.isAlive) {
      poisonTarget.isAlive = false;
      poisonTarget.deathReason = 'Trúng độc dược Phù Thủy';
      poisonTarget.deathRound = room.gameState.roundNumber;
      poisonTarget.deathPhase = 'NIGHT';
      victims.push({
        playerId: poisonTarget.id,
        playerName: poisonTarget.nickname,
        roleName: ROLES_DATABASE[poisonTarget.role!]?.vietnameseName,
        reason: 'Bị trúng độc dược bí ẩn',
      });
    }
  }

  // 3. Process Serial Killer
  if (ns.serialKillerTarget) {
    const skTarget = room.players.find((p) => p.id === ns.serialKillerTarget);
    if (skTarget && skTarget.isAlive) {
      if (isProtectedByBodyguard(skTarget.id)) {
        // Bodyguard blocked
      } else {
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
        }
      }
    }
  }

  // 4. Process Liễu (Willow Silencer)
  // Clear any past round silences
  room.players.forEach((p) => {
    if (p.isSilenced && (p.silencedUntilRound || 0) < room.gameState!.roundNumber) {
      p.isSilenced = false;
    }
  });

  if (ns.lieuTarget) {
    const lieuTargetPlayer = room.players.find((p) => p.id === ns.lieuTarget);
    if (lieuTargetPlayer && lieuTargetPlayer.isAlive) {
      lieuTargetPlayer.isSilenced = true;
      lieuTargetPlayer.silencedUntilRound = room.gameState.roundNumber;

      // Force mute silenced player in voiceStates
      if (room.voiceStates && room.voiceStates[lieuTargetPlayer.id]) {
        room.voiceStates[lieuTargetPlayer.id].isMuted = true;
        room.voiceStates[lieuTargetPlayer.id].isSpeaking = false;
        room.voiceStates[lieuTargetPlayer.id].isSilenced = true;
      }

      room.gameState.logs.push({
        id: `log_lieu_${Date.now()}`,
        round: room.gameState.roundNumber,
        phase: 'NIGHT',
        timestamp: Date.now(),
        message: `🤐 Nữ Thần Liễu đã niệm chú phong ấn câm lặng lên ${lieuTargetPlayer.nickname}! Người này bị khóa mic và cấm chat trong suốt ngày hôm nay.`,
        type: 'WARNING',
        isPublic: true,
      });
    }
  }

  // Save victims to GameState
  room.gameState.lastNightVictims = victims;

  // Check if Hunter was killed -> Hunter revenge shot
  const killedHunter = victims.find((v) => {
    const p = room.players.find((x) => x.id === v.playerId);
    return p?.role === 'HUNTER';
  });

  // Check victory
  const victoryCheck = checkVictory(room);
  if (victoryCheck.gameOver) {
    triggerGameOver(room, victoryCheck.winner!, victoryCheck.message!);
    return;
  }

  if (killedHunter) {
    // Transition to Hunter Revenge phase
    triggerHunterRevenge(room, killedHunter.playerId);
  } else {
    // Transition to Day Announcement
    startDayPhase(room);
  }
}

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
        room.gameState?.lastNightVictims.push({
          playerId: shotTarget.id,
          playerName: shotTarget.nickname,
          roleName: ROLES_DATABASE[shotTarget.role!]?.vietnameseName,
          reason: 'Bị phát đạn giận dữ của Thợ Săn bắn gục',
        });
      }
      startDayPhase(room);
    }, 3000);
  } else {
    // Wait for Hunter action or timeout
    setTimeout(() => {
      if (room.gameState && room.gameState.currentPhase === 'HUNTER_REVENGE') {
        startDayPhase(room);
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
  simulateBotVotes(room);

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
  const aliveBots = alivePlayers.filter((p) => p.isBot);

  aliveBots.forEach((bot) => {
    const potentialTargets = alivePlayers.filter((p) => p.id !== bot.id);
    if (potentialTargets.length > 0) {
      const chosen = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
      vs.votes[bot.id] = chosen.id;
    }
  });
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

  // Advance to next round & Night
  setTimeout(() => {
    if (!room.gameState) return;
    room.gameState.roundNumber += 1;
    startNightPhase(room);
  }, 6000);
}

// Trigger Game Over & Reveal
function triggerGameOver(room: RoomData, winner: any, message: string) {
  if (!room.gameState) return;

  room.gameState.currentPhase = 'GAME_OVER';
  room.gameState.winnerTeam = winner;
  room.gameState.winnerMessage = message;
  room.status = 'FINISHED';

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
          if (!room || !room.gameState || room.gameState.currentPhase !== 'NIGHT') return;

          const player = room.players.find((p) => p.id === playerId);
          if (!player || !player.isAlive || !player.role) return;

          const action: GameAction = payload;
          const ns = room.gameState.nightState;
          if (!ns) return;

          if (action.actionType === 'WOLF_KILL' && ROLES_DATABASE[player.role].team === 'WEREWOLF') {
            if (action.targetPlayerId) {
              ns.werewolfVotes[player.id] = action.targetPlayerId;
              ns.werewolfTarget = action.targetPlayerId;
              broadcastRoom(roomId, 'ROOM_STATE');
            }
          } else if (action.actionType === 'SEER_CHECK' && player.role === 'SEER') {
            if (action.targetPlayerId) {
              ns.seerTarget = action.targetPlayerId;
              const target = room.players.find((p) => p.id === action.targetPlayerId);
              const isWolf = target?.role ? ROLES_DATABASE[target.role].team === 'WEREWOLF' : false;

              sendToPlayer(playerId, 'ACTION_RESULT', {
                actionType: 'SEER_CHECK',
                targetName: target?.nickname || 'Mục tiêu',
                isWerewolf: isWolf,
              });
            }
          } else if (action.actionType === 'BODYGUARD_GUARD' && player.role === 'BODYGUARD') {
            if (action.targetPlayerId) {
              if (!room.settings.allowSelfProtectConsecutive && ns.lastGuardedPlayerId === action.targetPlayerId) {
                sendToPlayer(playerId, 'ERROR', { message: 'Không thể bảo vệ cùng 1 người trong 2 đêm liên tiếp.' });
                return;
              }
              ns.bodyguardTarget = action.targetPlayerId;
              ns.lastGuardedPlayerId = action.targetPlayerId;
            }
          } else if (action.actionType === 'WITCH_HEAL' && player.role === 'WITCH') {
            if (ns.witchHasHeal) {
              ns.witchSaved = true;
              ns.witchHasHeal = false;
            }
          } else if (action.actionType === 'WITCH_POISON' && player.role === 'WITCH') {
            if (ns.witchHasPoison && action.targetPlayerId) {
              ns.witchPoisonTarget = action.targetPlayerId;
              ns.witchHasPoison = false;
            }
          } else if (action.actionType === 'SERIAL_KILL' && player.role === 'SERIAL_KILLER') {
            if (action.targetPlayerId) {
              ns.serialKillerTarget = action.targetPlayerId;
            }
          } else if (action.actionType === 'LIEU_SILENCE' && player.role === 'LIEU') {
            if (action.targetPlayerId) {
              ns.lieuTarget = action.targetPlayerId;
              const target = room.players.find((p) => p.id === action.targetPlayerId);
              sendToPlayer(playerId, 'ACTION_RESULT', {
                actionType: 'LIEU_SILENCE',
                targetName: target?.nickname || 'Mục tiêu',
                success: true,
              });
            }
          } else if (action.actionType === 'HUNTER_KILL' && player.role === 'HUNTER') {
            if (action.targetPlayerId) {
              const target = room.players.find((p) => p.id === action.targetPlayerId);
              if (target && target.isAlive) {
                target.isAlive = false;
                target.deathReason = 'Bị Thợ Săn bắn gục';
                room.gameState.lastNightVictims.push({
                  playerId: target.id,
                  playerName: target.nickname,
                  roleName: ROLES_DATABASE[target.role!]?.vietnameseName,
                  reason: 'Bị phát đạn thù hận của Thợ Săn bắn hạ',
                });
                startDayPhase(room);
              }
            }
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

          // Block dead players from chatting in Living Day channel
          if (!player.isAlive && channel === 'DAY_PUBLIC') {
            sendToPlayer(playerId, 'ERROR', { message: 'Linh hồn đã chết chỉ có thể nhắn tin trong kênh Cõi Âm (Ghost Chat).' });
            return;
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
          const isNightTime = currentPhase === 'NIGHT' || currentPhase === 'ROLE_REVEAL' || currentPhase === 'HUNTER_REVENGE';

          let effectiveMuted = isMutedReq;
          let effectiveSpeaking = isSpeakingReq;

          // Rule 1: Night time - ALL mics forced off
          if (isNightTime && !effectiveMuted) {
            effectiveMuted = true;
            effectiveSpeaking = false;
            sendToPlayer(playerId, 'ERROR', { message: '🌙 Màn đêm buông xuống! Toàn bộ mic bị vô hiệu hóa để bảo đảm bí mật đêm.' });
          }

          // Rule 2: Silenced by Liễu - cannot unmute during day
          if (player.isSilenced && !effectiveMuted && currentPhase !== 'LOBBY') {
            effectiveMuted = true;
            effectiveSpeaking = false;
            sendToPlayer(playerId, 'ERROR', { message: '🤐 Bạn đang bị Liễu phong ấn câm lặng! Không thể mở mic trong ngày hôm nay.' });
          }

          // Rule 3: Dead players in active game cannot speak in living discussion
          if (!player.isAlive && !effectiveMuted && currentPhase && currentPhase !== 'LOBBY' && currentPhase !== 'GAME_OVER') {
            effectiveMuted = true;
            effectiveSpeaking = false;
            sendToPlayer(playerId, 'ERROR', { message: '👻 Linh hồn người đã chết không thể mở mic nói chuyện với người sống.' });
          }

          if (!room.voiceStates) room.voiceStates = {};
          room.voiceStates[playerId] = {
            playerId,
            nickname: player.nickname,
            isMuted: effectiveMuted,
            isSpeaking: effectiveMuted ? false : effectiveSpeaking,
            isDeafened: isDeafenedReq,
            isSilenced: player.isSilenced,
          };

          broadcastRoom(roomId, 'VOICE_STATUS_UPDATE', { voiceStates: room.voiceStates });
          break;
        }

        case 'VOICE_SIGNAL': {
          if (!roomId || !playerId) return;
          const room = rooms.get(roomId);
          if (!room) return;

          const currentPhase = room.gameState?.currentPhase;
          const isNightTime = currentPhase === 'NIGHT' || currentPhase === 'ROLE_REVEAL' || currentPhase === 'HUNTER_REVENGE';
          if (isNightTime) return; // Drop audio signals during night

          const player = room.players.find((p) => p.id === playerId);
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