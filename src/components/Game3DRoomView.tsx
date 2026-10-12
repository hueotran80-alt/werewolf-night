// ============================================================================
// WEREWOLF: NIGHT OF DECEPTION - 3D GAME ROOM VIEW (REALTIME SCENE ARCHITECT)
// ============================================================================

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Moon,
  Sun,
  Flame,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  MessageSquare,
  Send,
  X,
  Check,
  Skull,
  Shield,
  Eye,
  EyeOff,
  Gavel,
  Sparkles,
  Clock,
  Compass,
  Maximize2,
  Minimize2,
  Users,
  Radio,
  RotateCcw,
  FileText,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Crown,
  Heart,
  HelpCircle,
  AlertCircle,
  Bot,
  Zap,
  UserX,
  Layers,
} from 'lucide-react';

import {
  RoomData,
  GameState,
  Player,
  RoleId,
  GamePhase,
  NightStep,
  GameAction,
  ChatMessage,
  VoiceUserState,
  DeckCardConfig,
} from '../types';
import { ROLES_DATABASE, DECK_PRESETS } from '../data/rolesData';
import { soundManager } from '../services/soundService';
import { useGame } from '../context/GameContext';
import { PlayerAvatar } from './PlayerAvatar';
import { DeckBuilderModal } from './DeckBuilderModal';

export interface Game3DRoomViewProps {
  room?: RoomData;
  myPlayer?: Player;
  myRole?: RoleId | null;
  onSubmitAction?: (action: GameAction) => void;
  onSubmitVote?: (targetPlayerId: string) => void;
  onSendChat?: (text: string, channel?: any) => void;
  chatMessages?: ChatMessage[];
  onOpenMyCard?: () => void;
  onPlayerClick?: (player: Player) => void;
  onPlayerAvatarClick?: (playerId: string) => void;
  onStartGame?: () => void;
  onLeaveRoom?: () => void;
  onSwitchTo2D?: () => void;
  onAddBot?: () => void;
  onAddSmartBot?: () => void;
  onUpdateDeck?: (newDeck: DeckCardConfig[]) => void;
  onKickPlayer?: (playerId: string) => void;
  isHost?: boolean;
  onClose?: () => void;
  className?: string;
}

export type CameraViewMode = 'overview' | 'pov' | 'cinematic';

export interface CardTrajectory {
  playerId: string;
  isPlayer: boolean;
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  inspectPos: THREE.Vector3;
  groundYaw: number;
  qGround: THREE.Quaternion;
  qInspect: THREE.Quaternion;
  progress: number;
  delay: number;
  phase: 'idle' | 'dealing' | 'dealt' | 'inspecting' | 'facedown';
}

// Model assignments to cycle across players
const CHARACTER_MODELS = [
  '/models/Knight.glb',
  '/models/Mage.glb',
  '/models/Rogue.glb',
  '/models/Soldier.glb',
  '/models/Xbot.glb',
  '/models/Ybot.glb',
];
// Helper for smooth character animation transitions (Idle -> Walk -> Run -> Sit -> Hold Card)
const playCharacterAnimation = (
  group: THREE.Group,
  mixer: THREE.AnimationMixer,
  animType: 'idle' | 'walk' | 'run' | 'sit' | 'hold_card'
) => {
  const clips: THREE.AnimationClip[] = group.userData.animations || [];
  if (!clips || clips.length === 0) return;

  if (group.userData.currentAnimType === animType) return;

  let targetClip: THREE.AnimationClip | undefined;

  if (animType === 'hold_card') {
    targetClip = clips.find((c) => c.name.toLowerCase().includes('hold_card')) ||
                 clips.find((c) => c.name.toLowerCase().includes('sit'));
  } else if (animType === 'sit') {
    targetClip = clips.find((c) => {
      const n = c.name.toLowerCase();
      return (
        n === 'sit_floor_idle' ||
        n === 'sit_floor_pose' ||
        n === 'sit_chair_idle' ||
        n === 'sit_floor_down'
      );
    });
    if (!targetClip) {
      targetClip = clips.find((c) => c.name.toLowerCase().includes('sit'));
    }
    if (!targetClip) {
      targetClip = clips.find((c) => c.name.toLowerCase().includes('idle'));
    }
  } else if (animType === 'run') {
    targetClip = clips.find((c) => {
      const n = c.name.toLowerCase();
      return (
        n === 'running_a' ||
        n === 'run' ||
        n === 'running_b' ||
        n.includes('run')
      );
    });
    if (!targetClip) {
      targetClip = clips.find((c) => c.name.toLowerCase().includes('walk'));
    }
  } else if (animType === 'walk') {
    targetClip = clips.find((c) => {
      const n = c.name.toLowerCase();
      return (
        n === 'walking_a' ||
        n === 'walk' ||
        n === 'walking_b' ||
        n.includes('walk')
      );
    });
  } else {
    // idle
    targetClip = clips.find((c) => {
      const n = c.name.toLowerCase();
      return n === 'idle' || n === 'unarmed_idle';
    });
    if (!targetClip) {
      targetClip = clips.find((c) => c.name.toLowerCase().includes('idle'));
    }
  }

  if (!targetClip && clips.length > 0) {
    targetClip = clips[0];
  }
  if (!targetClip) return;

  const prevAction: THREE.AnimationAction | undefined = group.userData.currentAction;
  const newAction = mixer.clipAction(targetClip);

  if (prevAction === newAction) {
    group.userData.currentAnimType = animType;
    return;
  }

  newAction.reset();
  newAction.enabled = true;
  newAction.setEffectiveTimeScale(1);
  newAction.setEffectiveWeight(1);

  if (prevAction) {
    prevAction.crossFadeTo(newAction, 0.22, true);
  }
  newAction.play();

  // If model does not have a native sit animation (e.g. Soldier, Xbot, Ybot), adjust Y height slightly
  const modelMesh = group.userData.modelMesh as THREE.Object3D | undefined;
  if (modelMesh) {
    const hasSitClip = clips.some((c) => c.name.toLowerCase().includes('sit'));
    if (!hasSitClip && animType === 'sit') {
      modelMesh.position.y = -0.32;
    } else {
      modelMesh.position.y = 0;
    }
  }

  group.userData.currentAction = newAction;
  group.userData.currentAnimType = animType;
};

export const Game3DRoomView: React.FC<Game3DRoomViewProps> = (props) => {
  // Gracefully connect to context if props are not explicitly provided
  let context: ReturnType<typeof useGame> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    context = useGame();
  } catch {
    // Context might not be present if mounted in isolation
  }

  const room = props.room || context?.currentRoom || null;
  const myPlayer = props.myPlayer || context?.myPlayer || null;
  const myRole = props.myRole ?? context?.myRole ?? null;
  const onSubmitAction = props.onSubmitAction || context?.submitAction;
  const onSubmitVote = props.onSubmitVote || context?.submitVote;
  const onSendChat = props.onSendChat || context?.sendChat;
  const chatMessages = props.chatMessages || context?.chatMessages || [];
  const voiceStates = room?.voiceStates || context?.voiceStates || {};
  const isMyMicMuted = context?.isMyMicMuted ?? true;
  const isMySpeaking = context?.isMySpeaking ?? false;
  const isMyDeafened = context?.isMyDeafened ?? false;
  const toggleMic = context?.toggleMic;
  const toggleDeafen = context?.toggleDeafen;
  const onAddBot = props.onAddBot || context?.addBotPlayer;
  const onAddSmartBot = props.onAddSmartBot || context?.addSmartBotPlayer;
  const onUpdateDeck = props.onUpdateDeck || context?.updateDeck;
  const onKickPlayer = props.onKickPlayer || context?.kickPlayer;
  const isHostUser = Boolean(props.isHost || myPlayer?.isHost || (room && myPlayer && room.hostPlayerId === myPlayer.id));

  const gameState: GameState | undefined = room?.gameState;
  const currentPhase: GamePhase = gameState?.currentPhase || 'LOBBY';
  const players: Player[] = useMemo(() => room?.players || [], [room?.players]);

  // Local UI States
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(15);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('overview');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [show3DGuideModal, setShow3DGuideModal] = useState(false);
  const [isCardInspecting, setIsCardInspecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [now, setNow] = useState(Date.now());
  const [soundMuted, setSoundMuted] = useState(soundManager.isMuted);
  const [showDeckBuilder, setShowDeckBuilder] = useState(false);
  const [isFillingBots, setIsFillingBots] = useState(false);

  // Helper refs for hotkeys and interactions
  const handleInspectCardToggleRef = useRef<() => void>(() => {});
  const toggleMicRef = useRef(toggleMic);
  useEffect(() => {
    toggleMicRef.current = toggleMic;
  }, [toggleMic]);

  // Memoized player groups for quick actions
  const aliveOtherPlayers = useMemo(() => {
    return players.filter((p) => p.isAlive && p.id !== myPlayer?.id);
  }, [players, myPlayer?.id]);

  const myVotedTarget = useMemo(() => {
    if (!gameState?.votingState?.votes || !myPlayer) return null;
    const votedId = gameState.votingState.votes[myPlayer.id];
    if (!votedId) return null;
    return players.find((p) => p.id === votedId) || null;
  }, [gameState?.votingState?.votes, myPlayer, players]);

  // Free-Roam Movement States & References
  const [isTouchRunning, setIsTouchRunning] = useState(false);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const touchInputRef = useRef<{
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    run: boolean;
  }>({
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
  });
  const myPlayerPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 4.2));
  const myPlayerRot = useRef<number>(Math.PI);
  const botStatesRef = useRef<
    Map<
      string,
      {
        homePos: THREE.Vector3;
        targetPos: THREE.Vector3;
        isWalking: boolean;
        timer: number;
      }
    >
  >(new Map());

  const currentPhaseRef = useRef<GamePhase>(currentPhase);
  const cameraModeRef = useRef<CameraViewMode>(cameraMode);
  const voiceStatesRef = useRef(voiceStates);
  const propsRef = useRef(props);

  useEffect(() => {
    currentPhaseRef.current = currentPhase;
    const isLobby = currentPhase === 'LOBBY';
    cardMeshesRef.current.forEach((mesh) => {
      mesh.visible = !isLobby;
    });

    if (currentPhase === 'ROLE_REVEAL') {
      soundManager.playCardFlip();
    }
  }, [currentPhase]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    voiceStatesRef.current = voiceStates;
  }, [voiceStates]);

  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      keysPressed.current[key] = true;
      keysPressed.current[e.code.toLowerCase()] = true;

      // Quick 3D hotkeys
      if (key === 'v') {
        handleInspectCardToggleRef.current();
      } else if (key === 'm') {
        toggleMicRef.current?.();
      } else if (key === 'h' || key === '?') {
        setShow3DGuideModal((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
      keysPressed.current[e.code.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Deck count & balance calculations
  const totalCards = useMemo(() => {
    return room?.deck ? room.deck.reduce((sum, c) => sum + c.count, 0) : 0;
  }, [room?.deck]);

  const isDeckBalanced = totalCards === players.length && players.length >= 6;
  const canStartGame = isHostUser && players.length >= 6 && players.length <= 15 && isDeckBalanced;

  // Bot & Deck Actions
  const handleAddBot = useCallback(() => {
    if (!onAddBot) return;
    soundManager.playClick();
    onAddBot();
  }, [onAddBot]);

  const handleAddSmartBot = useCallback(() => {
    if (!onAddSmartBot) return;
    soundManager.playClick();
    onAddSmartBot();
  }, [onAddSmartBot]);

  const handleAutoBalanceDeck = useCallback(() => {
    if (!onUpdateDeck) return;
    soundManager.playClick();
    const count = Math.max(6, Math.min(15, players.length));

    if (count === 15) {
      const preset15 = DECK_PRESETS.find((p) => p.id === 'dark_fantasy_15');
      if (preset15) {
        onUpdateDeck(preset15.deck);
        context?.updateSettings?.({ mode: 'THREE_TEAM' });
        return;
      }
    }

    if (count >= 9) {
      const preset9 = DECK_PRESETS.find((p) => p.id === 'chaos_9_11');
      if (preset9) {
        const specialRoles = preset9.deck.filter((d) => d.roleId !== 'VILLAGER');
        const fixed = specialRoles.reduce((s, d) => s + d.count, 0);
        const villagers = Math.max(1, count - fixed);
        const newDeck: DeckCardConfig[] = [
          ...specialRoles.map((d) => ({ ...d })),
          { roleId: 'VILLAGER' as RoleId, count: villagers },
        ];
        onUpdateDeck(newDeck);
        context?.updateSettings?.({ mode: 'THREE_TEAM' });
        return;
      }
    }

    const preset6 = DECK_PRESETS.find((p) => p.id === 'classic_6_8');
    if (preset6) {
      const specialRoles = preset6.deck.filter((d) => d.roleId !== 'VILLAGER');
      const fixed = specialRoles.reduce((s, d) => s + d.count, 0);
      const villagers = Math.max(1, count - fixed);
      const newDeck: DeckCardConfig[] = [
        ...specialRoles.map((d) => ({ ...d })),
        { roleId: 'VILLAGER' as RoleId, count: villagers },
      ];
      onUpdateDeck(newDeck);
      context?.updateSettings?.({ mode: 'TWO_TEAM' });
      return;
    }

    onUpdateDeck([
      { roleId: 'WEREWOLF', count: 2 },
      { roleId: 'SEER', count: 1 },
      { roleId: 'BODYGUARD', count: 1 },
      { roleId: 'WITCH', count: 1 },
      { roleId: 'VILLAGER', count: Math.max(1, count - 5) },
    ]);
  }, [onUpdateDeck, players.length, context]);

  const handleFillTo6 = useCallback(() => {
    if (!onAddBot) return;
    soundManager.playClick();
    const needed = Math.max(0, 6 - players.length);
    if (needed <= 0) return;

    setIsFillingBots(true);
    for (let i = 0; i < needed; i++) {
      setTimeout(() => {
        onAddBot();
        if (i === needed - 1) {
          setIsFillingBots(false);
          setTimeout(() => {
            handleAutoBalanceDeck();
          }, 350);
        }
      }, i * 200);
    }
  }, [onAddBot, players.length, handleAutoBalanceDeck]);

  // Timer loop for countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(timer);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!gameState) return 0;
    if (gameState.isPaused) {
      return Math.ceil((gameState.pausedRemainingMs || 0) / 1000);
    }
    if (gameState.phaseEndsAt) {
      return Math.max(0, Math.ceil((gameState.phaseEndsAt - now) / 1000));
    }
    return 0;
  }, [gameState, now]);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Entities References
  const playerGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const playerMixersRef = useRef<Map<string, THREE.AnimationMixer>>(new Map());
  const playerVoiceRingsRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const playerVoteBadgesRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const cardMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const cardTrajectoriesRef = useRef<Map<string, CardTrajectory>>(new Map());
  const hostGroupRef = useRef<THREE.Group | null>(null);
  const hostMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const hostActionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const deckMeshRef = useRef<THREE.Group | null>(null);
  const deckLightRef = useRef<THREE.PointLight | null>(null);
  const deckAuraRef = useRef<THREE.Mesh | null>(null);
  const fireLightRef = useRef<THREE.PointLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const bloodMoonRef = useRef<THREE.Mesh | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const smokeParticlesRef = useRef<THREE.Points | null>(null);
  const fireParticlesRef = useRef<THREE.Points | null>(null);
  const celebrationParticlesRef = useRef<THREE.Points | null>(null);
  const selectionRingRef = useRef<THREE.Mesh | null>(null);

  // Camera animation interpolation targets
  const targetCamPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 6.2, 8.8));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.5, 0));
  const currentLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.5, 0));

  // Determine seating coordinates for players in a circle (6 to 15 players)
  // We offset angles so myPlayer is placed at angle = Math.PI / 2 (front bottom)
  const seatRadius = useMemo(() => {
    return Math.min(5.8, Math.max(3.2, 2.5 + (players.length * 0.22)));
  }, [players.length]);

  // Host deal launch origin position
  const hostDeckHandPos = useMemo(
    () => new THREE.Vector3(0, 1.25, -seatRadius * 0.95),
    [seatRadius]
  );

  const playerSeats = useMemo(() => {
    const list: Array<{
      player: Player;
      position: THREE.Vector3;
      lookAt: THREE.Vector3;
      cardPos: THREE.Vector3;
      cardInspectPos: THREE.Vector3;
      angle: number;
      lobbyPos: THREE.Vector3;
    }> = [];

    const myIndex = myPlayer ? players.findIndex((p) => p.id === myPlayer.id) : 0;
    const baseOffset = myIndex >= 0 ? myIndex : 0;
    const count = Math.max(1, players.length);

    players.forEach((p, index) => {
      // Offset so myPlayer is positioned at angle = Math.PI / 2
      const relativeIndex = (index - baseOffset + count) % count;
      const angle = (relativeIndex / count) * Math.PI * 2 + Math.PI / 2;

      const x = Math.cos(angle) * seatRadius;
      const z = Math.sin(angle) * seatRadius;
      const pos = new THREE.Vector3(x, 0, z);

      // Card sits slightly inward towards campfire
      const cardX = Math.cos(angle) * (seatRadius - 0.85);
      const cardZ = Math.sin(angle) * (seatRadius - 0.85);
      const cardPos = new THREE.Vector3(cardX, 0.018, cardZ);

      // Card inspected: floating in front of chest/eyes at Y ~ 1.15m
      const isMe = p.id === myPlayer?.id;
      const cardInspectPos = isMe
        ? new THREE.Vector3(x * 0.76, 1.15, z * 0.76)
        : new THREE.Vector3(x * 0.78, 0.95, z * 0.78);

      // In Lobby, scattered positions around the campfire (3.6m to 6.2m)
      const lobbyDist = 3.6 + ((index * 1.7) % 2.6);
      const lobbyAngle = (index / count) * Math.PI * 2 + 0.35;
      const lobbyPos = new THREE.Vector3(
        Math.cos(lobbyAngle) * lobbyDist,
        0,
        Math.sin(lobbyAngle) * lobbyDist
      );

      list.push({
        player: p,
        position: pos,
        lookAt: new THREE.Vector3(0, 0, 0),
        cardPos,
        cardInspectPos,
        angle,
        lobbyPos,
      });
    });

    return list;
  }, [players, myPlayer, seatRadius]);

  // Keep myPlayer initial position synced with their lobby position
  useEffect(() => {
    if (myPlayer) {
      const mySeat = playerSeats.find((s) => s.player.id === myPlayer.id);
      if (mySeat) {
        myPlayerPos.current.set(mySeat.lobbyPos.x, 0, mySeat.lobbyPos.z);
        myPlayerRot.current = Math.atan2(-mySeat.lobbyPos.x, -mySeat.lobbyPos.z);
      }
    }
  }, [myPlayer?.id, playerSeats]);

  // Find selected player object
  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return players.find((p) => p.id === selectedPlayerId) || null;
  }, [players, selectedPlayerId]);

  // Camera switcher
  const switchCameraMode = useCallback(
    (mode: CameraViewMode) => {
      setCameraMode(mode);
      if (mode === 'overview') {
        targetCamPos.current.set(0, 6.2, seatRadius + 4.5);
        targetLookAt.current.set(0, 0.5, 0);
        if (controlsRef.current) {
          controlsRef.current.enabled = true;
          controlsRef.current.enableRotate = true;
          controlsRef.current.enablePan = true;
          controlsRef.current.target.set(0, 0.5, 0);
        }
      } else if (mode === 'pov') {
        // POV: camera placed at myPlayer's eye level looking into the campfire or card
        const mySeat = playerSeats.find((s) => s.player.id === myPlayer?.id) || playerSeats[0];
        if (mySeat) {
          targetCamPos.current.set(mySeat.position.x * 0.95, 1.38, mySeat.position.z * 0.95);
          if (isCardInspecting) {
            targetLookAt.current.set(mySeat.cardInspectPos.x, mySeat.cardInspectPos.y, mySeat.cardInspectPos.z);
          } else {
            targetLookAt.current.set(0, 0.7, 0);
          }
        } else {
          targetCamPos.current.set(0, 1.38, seatRadius * 0.95);
          targetLookAt.current.set(0, 0.7, 0);
        }
        if (controlsRef.current) {
          controlsRef.current.enabled = false;
        }
      } else if (mode === 'cinematic') {
        if (controlsRef.current) {
          controlsRef.current.enabled = false;
        }
      }
    },
    [myPlayer?.id, playerSeats, seatRadius, isCardInspecting]
  );

  // ==========================================================================
  // 3D PARABOLIC CARD DEALING & INSPECT ACTIONS
  // ==========================================================================

  // Step 1: Deal Cards from Host Dais to Each Seated Player (Bézier arc ~ +2.2m)
  const triggerDealCards = useCallback(() => {
    soundManager.playClick();

    // 1. Quản trò vung tay phát bài (Deal_Cards, Give_Card, Throw, Interact)
    if (hostMixerRef.current && hostActionsRef.current) {
      const actions = hostActionsRef.current;
      const dealAct =
        actions['deal_cards'] ||
        actions['give_card'] ||
        actions['throw'] ||
        actions['interact'] ||
        actions['spellcast_raise'];
      if (dealAct) {
        dealAct.reset().setLoop(THREE.LoopOnce, 1).play();
      }
    }

    // 2. Cỗ bài trên bục Quản trò phát sáng rực rỡ
    if (deckLightRef.current) {
      deckLightRef.current.intensity = 5.0;
    }

    // 3. Từng lá bài phóng ra theo đường cong Parabol vút lên cao (+2.2m)
    let idx = 0;
    cardTrajectoriesRef.current.forEach((t) => {
      t.phase = 'dealing';
      t.progress = 0;
      t.startPos.copy(hostDeckHandPos);
      t.delay = idx * 0.12; // staggered delay ~120ms
      t.mesh.position.copy(hostDeckHandPos);
      t.mesh.quaternion.copy(t.qGround);
      t.mesh.visible = false;
      idx++;
    });

    // Sau khi lá bài hạ cánh phẳng xuống chiếu, phát âm thanh lật bài
    setTimeout(() => {
      soundManager.playCardFlip();
    }, 1800);
  }, [hostDeckHandPos]);

  // Step 2: Cầm lá bài lên xem vai trò bí mật (Inspect in POV)
  const handlePickAndInspectCard = useCallback(() => {
    if (!myPlayer) return;
    const myTraj = cardTrajectoriesRef.current.get(myPlayer.id);
    if (!myTraj) return;

    soundManager.playCardFlip();
    setIsCardInspecting(true);

    // Tự động chuyển camera sang góc nhìn cá nhân (POV) và nhìn thẳng vào thẻ bài
    switchCameraMode('pov');
    targetLookAt.current.set(myTraj.inspectPos.x, myTraj.inspectPos.y, myTraj.inspectPos.z);

    myTraj.phase = 'inspecting';
    myTraj.progress = 0;

    // Seated character animation
    const myGroup = playerGroupsRef.current.get(myPlayer.id);
    const myMixer = playerMixersRef.current.get(myPlayer.id);
    if (myGroup && myMixer) {
      playCharacterAnimation(myGroup, myMixer, 'hold_card');
    }
  }, [myPlayer, switchCameraMode]);

  // Step 3: Đặt úp bài trở lại chiếu cói
  const handlePlaceCardFaceDown = useCallback(() => {
    if (!myPlayer) return;
    const myTraj = cardTrajectoriesRef.current.get(myPlayer.id);
    if (!myTraj) return;

    soundManager.playCardFlip();
    setIsCardInspecting(false);

    myTraj.phase = 'facedown';
    myTraj.progress = 0;

    if (cameraModeRef.current === 'pov') {
      targetLookAt.current.set(0, 0.7, 0);
    }

    // Seated character animation
    const myGroup = playerGroupsRef.current.get(myPlayer.id);
    const myMixer = playerMixersRef.current.get(myPlayer.id);
    if (myGroup && myMixer) {
      playCharacterAnimation(myGroup, myMixer, 'sit');
    }
  }, [myPlayer]);

  // Toggle Inspect / Place Down
  const handleInspectCardToggle = useCallback(() => {
    if (isCardInspecting) {
      handlePlaceCardFaceDown();
    } else {
      handlePickAndInspectCard();
    }
  }, [isCardInspecting, handlePlaceCardFaceDown, handlePickAndInspectCard]);

  useEffect(() => {
    handleInspectCardToggleRef.current = handleInspectCardToggle;
  }, [handleInspectCardToggle]);

  // Tự động kích hoạt chia bài 3D khi chuyển sang phase ROLE_REVEAL
  const prevPhaseRef = useRef<GamePhase>(currentPhase);
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = currentPhase;
    currentPhaseRef.current = currentPhase;

    if (currentPhase === 'ROLE_REVEAL') {
      triggerDealCards();
    } else if (currentPhase === 'LOBBY') {
      cardTrajectoriesRef.current.forEach((t) => {
        t.phase = 'idle';
        t.mesh.visible = false;
      });
      setIsCardInspecting(false);
    } else {
      cardTrajectoriesRef.current.forEach((t) => {
        if (t.phase === 'idle' || t.phase === 'dealing') {
          t.phase = 'dealt';
          t.mesh.position.copy(t.targetPos);
          t.mesh.quaternion.copy(t.qGround);
          t.mesh.visible = true;
        }
      });
    }
  }, [currentPhase, triggerDealCards]);

  // Cập nhật Texture vai trò cá nhân của myPlayer khi myRole có thay đổi
  useEffect(() => {
    if (!myPlayer || !myRole) return;
    const myCardMesh = cardMeshesRef.current.get(myPlayer.id);
    if (!myCardMesh) return;

    const texLoader = new THREE.TextureLoader();
    const roleTex = texLoader.load(`/cards/${myRole.toLowerCase()}.png`);
    roleTex.colorSpace = THREE.SRGBColorSpace;
    const roleMat = new THREE.MeshStandardMaterial({
      map: roleTex,
      roughness: 0.45,
      metalness: 0.1,
    });
    if (Array.isArray(myCardMesh.material)) {
      myCardMesh.material[5] = roleMat;
      roleMat.needsUpdate = true;
    }
  }, [myPlayer?.id, myRole]);

  // Sound effects on phase transitions
  useEffect(() => {
    if (currentPhase === 'NIGHT') {
      soundManager.playWolfHowl();
    } else if (currentPhase === 'DAY_ANNOUNCEMENT') {
      soundManager.playMorningBell();
    } else if (currentPhase === 'VOTING') {
      soundManager.playGavelStrike();
    } else if (currentPhase === 'GAME_OVER') {
      soundManager.playVictory();
    }
  }, [currentPhase]);

  // ==========================================================================
  // PROCEDURAL HELPER: CREATE TEXTURE FOR 3D SPRITE NAMEPLATE & BADGES
  // ==========================================================================
  const createPlayerBadgeTexture = useCallback(
    (player: Player, votes = 0, isSpeaking = false) => {
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.clearRect(0, 0, 384, 128);

      // Background rounded pill
      const bgGrad = ctx.createLinearGradient(0, 0, 384, 128);
      if (!player.isAlive) {
        bgGrad.addColorStop(0, 'rgba(40, 20, 25, 0.85)');
        bgGrad.addColorStop(1, 'rgba(20, 15, 20, 0.9)');
      } else if (isSpeaking) {
        bgGrad.addColorStop(0, 'rgba(6, 95, 70, 0.95)');
        bgGrad.addColorStop(1, 'rgba(4, 120, 87, 0.95)');
      } else {
        bgGrad.addColorStop(0, 'rgba(24, 24, 27, 0.85)');
        bgGrad.addColorStop(1, 'rgba(9, 9, 11, 0.9)');
      }

      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.roundRect(16, 16, 352, 96, [24]);
      ctx.fill();

      // Border glow
      ctx.lineWidth = isSpeaking ? 5 : 3;
      ctx.strokeStyle = isSpeaking
        ? '#34d399'
        : !player.isAlive
        ? '#f43f5e'
        : player.isHost
        ? '#fbbf24'
        : '#52525b';
      ctx.stroke();

      // Nickname Text
      ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cleanName =
        player.nickname.length > 14
          ? player.nickname.substring(0, 13) + '…'
          : player.nickname;
      ctx.fillText(cleanName, 192, 54);

      // Sub-status Text
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      if (!player.isAlive) {
        ctx.fillStyle = '#f87171';
        ctx.fillText('💀 ĐÃ CHẾT', 192, 88);
      } else if (isSpeaking) {
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText('🎙️ ĐANG NÓI...', 192, 88);
      } else if (votes > 0) {
        ctx.fillStyle = '#fde047';
        ctx.fillText(`⚖️ ${votes} PHIẾU TREO CỔ`, 192, 88);
      } else if (player.isHost) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('👑 CHỦ PHÒNG', 192, 88);
      } else if (player.isReady) {
        ctx.fillStyle = '#34d399';
        ctx.fillText('✓ SẴN SÀNG', 192, 88);
      } else {
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText('• DÂN LÀNG', 192, 88);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    },
    []
  );

  // ==========================================================================
  // PROCEDURAL TOMBSTONE GENERATOR
  // ==========================================================================
  const createTombstoneGroup = useCallback(() => {
    const group = new THREE.Group();

    // 1. Stone Plinth / Base
    const baseGeom = new THREE.BoxGeometry(0.85, 0.2, 0.55);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x474747,
      roughness: 0.88,
      metalness: 0.1,
    });
    const baseMesh = new THREE.Mesh(baseGeom, stoneMat);
    baseMesh.position.y = 0.1;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // 2. Gravestone Upright Slab (Arched top)
    const slabGeom = new THREE.BoxGeometry(0.68, 0.95, 0.16);
    const slabMesh = new THREE.Mesh(slabGeom, stoneMat);
    slabMesh.position.y = 0.65;
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    group.add(slabMesh);

    const archGeom = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 24, 1, false, 0, Math.PI);
    const archMesh = new THREE.Mesh(archGeom, stoneMat);
    archMesh.rotation.z = Math.PI / 2;
    archMesh.rotation.y = -Math.PI / 2;
    archMesh.position.y = 1.12;
    archMesh.castShadow = true;
    group.add(archMesh);

    // 3. Engraved Cross on Gravestone
    const crossVGeom = new THREE.BoxGeometry(0.08, 0.42, 0.04);
    const crossHGeom = new THREE.BoxGeometry(0.26, 0.08, 0.04);
    const crossMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95 });
    const crossV = new THREE.Mesh(crossVGeom, crossMat);
    crossV.position.set(0, 0.78, 0.09);
    const crossH = new THREE.Mesh(crossHGeom, crossMat);
    crossH.position.set(0, 0.86, 0.09);
    group.add(crossV);
    group.add(crossH);

    // 4. Ethereal Floating Ghost / Spectral Spirit
    const ghostGroup = new THREE.Group();
    ghostGroup.name = 'ghostGroup';
    ghostGroup.position.set(0, 1.6, 0);

    const ghostGeom = new THREE.SphereGeometry(0.24, 16, 16);
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.65,
      roughness: 0.2,
    });
    const ghostHead = new THREE.Mesh(ghostGeom, ghostMat);
    ghostGroup.add(ghostHead);

    // Glowing eyes
    const eyeGeom = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
    eyeL.position.set(-0.08, 0.04, 0.21);
    const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
    eyeR.position.set(0.08, 0.04, 0.21);
    ghostGroup.add(eyeL);
    ghostGroup.add(eyeR);

    // Spectral Tail / Wisps
    const tailGeom = new THREE.ConeGeometry(0.2, 0.5, 12);
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.4,
    });
    const tailMesh = new THREE.Mesh(tailGeom, tailMat);
    tailMesh.rotation.x = Math.PI;
    tailMesh.position.y = -0.28;
    ghostGroup.add(tailMesh);

    group.add(ghostGroup);

    return group;
  }, []);

  // ==========================================================================
  // MAIN THREE.JS CANVAS LIFECYCLE & SCENE BUILDER
  // ==========================================================================
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.018);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 120);
    camera.position.set(0, 6.2, seatRadius + 4.5);
    camera.lookAt(0, 0.5, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 2.0;
    controls.maxDistance = 26.0;
    controls.target.set(0, 0.5, 0);
    controlsRef.current = controls;

    // 5. Lighting Environment
    const dirLight = new THREE.DirectionalLight(0xffedd5, 1.8);
    dirLight.position.set(8, 16, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 40;
    const d = 12;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0004;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 0.8);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    // Campfire Dynamic Point Light
    const fireLight = new THREE.PointLight(0xff6b1a, 3.5, 14, 1.5);
    fireLight.position.set(0, 0.65, 0);
    fireLight.castShadow = true;
    fireLight.shadow.bias = -0.001;
    scene.add(fireLight);
    fireLightRef.current = fireLight;

    // 6. Sky Celestial Bodies (Sun & Blood Moon)
    const bloodMoonGeom = new THREE.SphereGeometry(2.4, 24, 24);
    const bloodMoonMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const bloodMoon = new THREE.Mesh(bloodMoonGeom, bloodMoonMat);
    bloodMoon.position.set(22, 38, -25);
    scene.add(bloodMoon);
    bloodMoonRef.current = bloodMoon;

    const sunGeom = new THREE.SphereGeometry(2.6, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.position.set(-25, 42, -20);
    sunMesh.visible = false;
    scene.add(sunMesh);
    sunMeshRef.current = sunMesh;

    // 7. Ground Landscape
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const gctx = groundCanvas.getContext('2d');
    if (gctx) {
      gctx.fillStyle = '#1c2430';
      gctx.fillRect(0, 0, 512, 512);

      // Noise speckles
      for (let i = 0; i < 3500; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        gctx.fillStyle = Math.random() > 0.5 ? '#243040' : '#141a24';
        gctx.beginPath();
        gctx.arc(x, y, Math.random() * 2 + 1, 0, Math.PI * 2);
        gctx.fill();
      }

      // Dirt center ring where players sit
      const grad = gctx.createRadialGradient(256, 256, 30, 256, 256, 230);
      grad.addColorStop(0, 'rgba(80, 50, 30, 0.5)');
      grad.addColorStop(0.65, 'rgba(50, 40, 35, 0.3)');
      grad.addColorStop(1, 'rgba(28, 36, 48, 0)');
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 512, 512);
    }

    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(6, 6);

    const groundGeom = new THREE.PlaneGeometry(60, 60, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.9,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 8. Campfire Hearth & Burning Firewood
    const hearthGroup = new THREE.Group();
    const stoneGeom = new THREE.DodecahedronGeometry(0.24, 1);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.85 });
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const stone = new THREE.Mesh(stoneGeom, stoneMat);
      stone.position.set(Math.cos(angle) * 0.95, 0.1, Math.sin(angle) * 0.95);
      stone.rotation.set(Math.random(), Math.random(), Math.random());
      stone.scale.set(1 + Math.random() * 0.3, 0.8 + Math.random() * 0.2, 1 + Math.random() * 0.3);
      stone.castShadow = true;
      stone.receiveShadow = true;
      hearthGroup.add(stone);
    }

    const logGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
      const log = new THREE.Mesh(logGeom, logMat);
      log.position.set((Math.random() - 0.5) * 0.25, 0.14, (Math.random() - 0.5) * 0.25);
      log.rotation.set(0.35, (i * Math.PI) / 3, 1.25);
      log.castShadow = true;
      hearthGroup.add(log);
    }
    scene.add(hearthGroup);

    // 9. Fire & Smoke Particle Emitters
    // Campfire sparks / flames
    const fireParticleCount = 45;
    const fireGeo = new THREE.BufferGeometry();
    const firePositions = new Float32Array(fireParticleCount * 3);
    for (let i = 0; i < fireParticleCount; i++) {
      firePositions[i * 3] = (Math.random() - 0.5) * 0.5;
      firePositions[i * 3 + 1] = 0.2 + Math.random() * 0.9;
      firePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    fireGeo.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
    const fireMat = new THREE.PointsMaterial({
      color: 0xffa040,
      size: 0.22,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const fireParticles = new THREE.Points(fireGeo, fireMat);
    scene.add(fireParticles);
    fireParticlesRef.current = fireParticles;

    // Campfire Smoke
    const smokeCount = 40;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(smokeCount * 3);
    for (let i = 0; i < smokeCount; i++) {
      smokePositions[i * 3] = (Math.random() - 0.5) * 0.6;
      smokePositions[i * 3 + 1] = 0.5 + Math.random() * 4.0;
      smokePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    const smokeMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.35,
      transparent: true,
      opacity: 0.28,
    });
    const smokeParticles = new THREE.Points(smokeGeo, smokeMat);
    scene.add(smokeParticles);
    smokeParticlesRef.current = smokeParticles;

    // Celebration Confetti/Fireworks for GAME_OVER
    const celebCount = 120;
    const celebGeo = new THREE.BufferGeometry();
    const celebPositions = new Float32Array(celebCount * 3);
    const celebColors = new Float32Array(celebCount * 3);
    for (let i = 0; i < celebCount; i++) {
      celebPositions[i * 3] = (Math.random() - 0.5) * 16;
      celebPositions[i * 3 + 1] = 2.0 + Math.random() * 8.0;
      celebPositions[i * 3 + 2] = (Math.random() - 0.5) * 16;
      celebColors[i * 3] = Math.random();
      celebColors[i * 3 + 1] = Math.random();
      celebColors[i * 3 + 2] = Math.random();
    }
    celebGeo.setAttribute('position', new THREE.BufferAttribute(celebPositions, 3));
    celebGeo.setAttribute('color', new THREE.BufferAttribute(celebColors, 3));
    const celebMat = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const celebParticles = new THREE.Points(celebGeo, celebMat);
    celebParticles.visible = false;
    scene.add(celebParticles);
    celebrationParticlesRef.current = celebParticles;

    // 10. Perimeter Trees around the council clearing
    const trunkGeom = new THREE.CylinderGeometry(0.2, 0.28, 1.8, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 });
    const foliageGeom = new THREE.ConeGeometry(1.6, 3.4, 8);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1e3a24, roughness: 0.85 });

    const treeAngles = [0.2, 0.8, 1.4, 2.1, 2.8, 3.6, 4.3, 5.0, 5.7];
    treeAngles.forEach((ang) => {
      const dist = seatRadius + 5.5 + Math.random() * 2.5;
      const tx = Math.cos(ang) * dist;
      const tz = Math.sin(ang) * dist;

      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 0.9;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const f1 = new THREE.Mesh(foliageGeom, foliageMat);
      f1.position.y = 2.6;
      f1.castShadow = true;
      treeGroup.add(f1);

      const f2 = new THREE.Mesh(foliageGeom, foliageMat);
      f2.position.y = 3.8;
      f2.scale.set(0.72, 0.72, 0.72);
      f2.castShadow = true;
      treeGroup.add(f2);

      treeGroup.position.set(tx, 0, tz);
      scene.add(treeGroup);
    });

    // 11. Selection Target Aura Ring on the Ground
    const selRingGeom = new THREE.RingGeometry(0.75, 0.95, 32);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const selRing = new THREE.Mesh(selRingGeom, selRingMat);
    selRing.rotation.x = -Math.PI / 2;
    selRing.position.y = 0.025;
    selRing.visible = false;
    scene.add(selRing);
    selectionRingRef.current = selRing;

    // 12. Load Quản Trò (Host Narrator) Model & Dais
    const daisGeom = new THREE.CylinderGeometry(1.0, 1.15, 0.22, 32);
    const daisMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.85 });
    const daisMesh = new THREE.Mesh(daisGeom, daisMat);
    daisMesh.position.set(0, 0.11, -seatRadius * 0.95);
    daisMesh.receiveShadow = true;
    scene.add(daisMesh);

    const gltfLoader = new GLTFLoader();

    gltfLoader.load(
      '/models/Dealer_Host.glb',
      (gltf) => {
        if (isDisposed) return;
        const hostModel = gltf.scene;
        hostGroupRef.current = hostModel;
        hostModel.position.set(0, 0.22, -seatRadius * 0.95);
        hostModel.rotation.set(0, 0, 0);

        // Normalize height ~1.85m
        const bbox = new THREE.Box3().setFromObject(hostModel);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        if (size.y > 0) {
          hostModel.scale.setScalar(1.85 / size.y);
        }

        hostModel.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });
        scene.add(hostModel);

        const mixer = new THREE.AnimationMixer(hostModel);
        hostMixerRef.current = mixer;
        const actions: Record<string, THREE.AnimationAction> = {};
        gltf.animations.forEach((clip) => {
          actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
          actions[clip.name] = mixer.clipAction(clip);
        });
        hostActionsRef.current = actions;

        const idleClip =
          actions['dealer_idle'] ||
          actions['idle'] ||
          actions['unarmed_idle'];
        if (idleClip) {
          idleClip.play();
        } else if (gltf.animations.length > 0) {
          mixer.clipAction(gltf.animations[0]).play();
        }

        setLoadingProgress((prev) => Math.min(100, prev + 25));
      },
      undefined,
      (err) => {
        console.warn('Could not load Dealer_Host model, falling back to Knight:', err);
        // Fallback to Knight model for Host
        gltfLoader.load('/models/Knight.glb', (gltf2) => {
          if (isDisposed) return;
          const hostModel = gltf2.scene;
          hostGroupRef.current = hostModel;
          hostModel.position.set(0, 0.22, -seatRadius * 0.95);
          hostModel.rotation.set(0, 0, 0);
          hostModel.scale.setScalar(1.05);
          scene.add(hostModel);

          const mixer = new THREE.AnimationMixer(hostModel);
          hostMixerRef.current = mixer;
          const actions: Record<string, THREE.AnimationAction> = {};
          gltf2.animations.forEach((clip) => {
            actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
            actions[clip.name] = mixer.clipAction(clip);
          });
          hostActionsRef.current = actions;
          const idleAction = actions['idle'] || actions['unarmed_idle'];
          if (idleAction) idleAction.play();
        });
      }
    );

    // Host Deck Podium & Mystical Glowing Card Deck
    const stumpGeom = new THREE.CylinderGeometry(0.3, 0.35, 0.9, 16);
    const stumpMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 });
    const stump = new THREE.Mesh(stumpGeom, stumpMat);
    stump.position.set(0.38, 0.45, -seatRadius * 0.95 + 0.35);
    stump.castShadow = true;
    stump.receiveShadow = true;
    scene.add(stump);

    const deckGroup = new THREE.Group();
    deckMeshRef.current = deckGroup;
    const deckBlockGeom = new THREE.BoxGeometry(0.5, 0.14, 0.72);
    const deckBlockMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0x312e81,
      emissiveIntensity: 0.2,
    });
    const deckBlock = new THREE.Mesh(deckBlockGeom, deckBlockMat);
    deckBlock.position.set(0, 0.07, 0);
    deckBlock.castShadow = true;
    deckGroup.add(deckBlock);

    const deckTexLoader = new THREE.TextureLoader();
    const deckBackTex = deckTexLoader.load('/cards/back.png');
    deckBackTex.colorSpace = THREE.SRGBColorSpace;

    const topCardGeom = new THREE.PlaneGeometry(0.48, 0.7);
    const topCardMat = new THREE.MeshStandardMaterial({
      map: deckBackTex,
      roughness: 0.4,
    });
    const topCard = new THREE.Mesh(topCardGeom, topCardMat);
    topCard.rotation.x = -Math.PI / 2;
    topCard.position.y = 0.145;
    deckGroup.add(topCard);

    // Glowing Aura and Point Light on Host Deck
    const deckLight = new THREE.PointLight(0xf59e0b, 2.0, 4.0, 1.5);
    deckLight.position.set(0, 0.25, 0);
    deckLightRef.current = deckLight;
    deckGroup.add(deckLight);

    const deckAuraGeom = new THREE.RingGeometry(0.35, 0.55, 32);
    const deckAuraMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const deckAura = new THREE.Mesh(deckAuraGeom, deckAuraMat);
    deckAura.rotation.x = -Math.PI / 2;
    deckAura.position.y = 0.148;
    deckAuraRef.current = deckAura;
    deckGroup.add(deckAura);

    deckGroup.position.set(0.38, 0.9, -seatRadius * 0.95 + 0.35);
    scene.add(deckGroup);

    // 13. Build Player Seating, Models, Mats, Badges & Voice Rings
    const matGeom = new THREE.CylinderGeometry(0.72, 0.72, 0.035, 32);
    const matMat = new THREE.MeshStandardMaterial({
      color: 0xca8a04,
      roughness: 0.85,
      metalness: 0.05,
    });

    const voiceRingGeom = new THREE.TorusGeometry(0.48, 0.045, 8, 24);
    const voiceRingMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.85,
    });

    const cardGeom = new THREE.BoxGeometry(0.46, 0.7, 0.006);
    const cardEdgeMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 });
    const texLoader = new THREE.TextureLoader();
    const backTex = texLoader.load('/cards/back.png');
    backTex.colorSpace = THREE.SRGBColorSpace;
    const cardBackMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.45 });

    let loadedPlayers = 0;

    playerSeats.forEach((seat, idx) => {
      const p = seat.player;

      // 1. Straw Mat for each seat
      const mat = new THREE.Mesh(matGeom, matMat);
      mat.position.set(seat.position.x, 0.018, seat.position.z);
      mat.receiveShadow = true;
      mat.userData = { playerId: p.id };
      scene.add(mat);

      // 2. Seated Character OR Tombstone
      const pGroup = new THREE.Group();
      const isLobbyInitial = currentPhaseRef.current === 'LOBBY';
      if (isLobbyInitial) {
        if (p.id === myPlayer?.id) {
          pGroup.position.copy(myPlayerPos.current);
          pGroup.rotation.y = myPlayerRot.current;
        } else {
          pGroup.position.copy(seat.lobbyPos);
          pGroup.lookAt(0, 0, 0);
        }
      } else {
        pGroup.position.copy(seat.position);
        pGroup.lookAt(seat.lookAt.x, seat.position.y, seat.lookAt.z);
      }
      pGroup.userData = { playerId: p.id, player: p };
      scene.add(pGroup);
      playerGroupsRef.current.set(p.id, pGroup);

      if (!p.isAlive) {
        // Player is dead -> Render Tombstone with glowing ghost
        const tombstone = createTombstoneGroup();
        pGroup.add(tombstone);
      } else {
        // Player is alive -> Load character GLTF model
        const modelUrl = CHARACTER_MODELS[idx % CHARACTER_MODELS.length];
        gltfLoader.load(
          modelUrl,
          (gltf) => {
            if (isDisposed) return;
            const model = gltf.scene;

            // Height scaling
            const bbox = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            if (size.y > 0) {
              model.scale.setScalar(1.68 / size.y);
            }

            model.traverse((c) => {
              if ((c as THREE.Mesh).isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
              }
            });
            pGroup.add(model);

            const mixer = new THREE.AnimationMixer(model);
            playerMixersRef.current.set(p.id, mixer);
            pGroup.userData.animations = gltf.animations;
            pGroup.userData.modelMesh = model;

            // In Lobby: stand in idle. In Game: sit on the straw mat
            const isLobby = currentPhaseRef.current === 'LOBBY';
            playCharacterAnimation(pGroup, mixer, isLobby ? 'idle' : 'sit');

            loadedPlayers++;
            setLoadingProgress((prev) => Math.min(100, prev + 10));
            if (loadedPlayers >= playerSeats.length) {
              setLoading(false);
            }
          },
          undefined,
          () => {
            // Fallback mannequin if GLB fails
            const manGeom = new THREE.CylinderGeometry(0.3, 0.35, 1.3, 12);
            const manMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
            const man = new THREE.Mesh(manGeom, manMat);
            man.position.y = 0.65;
            pGroup.add(man);
            loadedPlayers++;
            if (loadedPlayers >= playerSeats.length) setLoading(false);
          }
        );
      }

      // 3. Speaking Voice Ring above head
      const voiceRing = new THREE.Mesh(voiceRingGeom, voiceRingMat);
      voiceRing.position.set(0, 1.95, 0);
      voiceRing.rotation.x = Math.PI / 2;
      voiceRing.visible = false;
      pGroup.add(voiceRing);
      playerVoiceRingsRef.current.set(p.id, voiceRing);

      // 4. Floating 3D Sprite Nameplate & Status Badge
      const isSpeaking = !!voiceStates[p.id]?.isSpeaking;
      const votesReceived = gameState?.votingState?.voteCounts?.[p.id] || 0;
      const badgeTex = createPlayerBadgeTexture(p, votesReceived, isSpeaking);
      if (badgeTex) {
        const spriteMat = new THREE.SpriteMaterial({ map: badgeTex, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(0, 2.35, 0);
        sprite.scale.set(1.5, 0.5, 1);
        pGroup.add(sprite);
        playerVoteBadgesRef.current.set(p.id, sprite);
      }

      // 5. Role Card on Mat
      // For myPlayer, face down or flippable.
      const isMe = p.id === myPlayer?.id;
      let frontMat = cardBackMat;
      if (isMe && myRole) {
        const roleTex = texLoader.load(`/cards/${myRole.toLowerCase()}.png`);
        roleTex.colorSpace = THREE.SRGBColorSpace;
        frontMat = new THREE.MeshStandardMaterial({ map: roleTex, roughness: 0.45 });
      }

      const cardMaterials = [
        cardEdgeMat,
        cardEdgeMat,
        cardEdgeMat,
        cardEdgeMat,
        cardBackMat, // Face 4 (+Z): Back of card
        frontMat,    // Face 5 (-Z): Role card front
      ];

      const cardMesh = new THREE.Mesh(cardGeom, cardMaterials);
      cardMesh.rotation.order = 'YXZ';
      const groundYaw = Math.atan2(-seat.position.x, -seat.position.z);
      cardMesh.rotation.set(-Math.PI / 2, groundYaw, 0);
      cardMesh.position.copy(seat.cardPos);
      cardMesh.visible = !isLobbyInitial;
      cardMesh.castShadow = true;
      cardMesh.receiveShadow = true;
      cardMesh.userData = { playerId: p.id, isPlayerCard: true };
      scene.add(cardMesh);
      cardMeshesRef.current.set(p.id, cardMesh);
    });

    if (playerSeats.length === 0) {
      setLoading(false);
    }

    // 14. Raycasting for Direct 3D Click Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Search intersectable player groups and mats
      const clickableObjects: THREE.Object3D[] = [];
      playerGroupsRef.current.forEach((grp) => clickableObjects.push(grp));
      cardMeshesRef.current.forEach((c) => clickableObjects.push(c));

      const intersects = raycaster.intersectObjects(clickableObjects, true);
      if (intersects.length > 0) {
        let hit: THREE.Object3D | null = intersects[0].object;
        while (hit && !hit.userData?.playerId && hit.parent) {
          hit = hit.parent;
        }

        const clickedPid = hit?.userData?.playerId;
        if (clickedPid) {
          soundManager.playClick();
          setSelectedPlayerId(clickedPid);
          const targetP = players.find((p) => p.id === clickedPid);
          if (targetP && props.onPlayerClick) {
            props.onPlayerClick(targetP);
          }
          if (props.onPlayerAvatarClick) {
            props.onPlayerAvatarClick(clickedPid);
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // 15. Animation Loop
    const clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Update Mixers
      if (hostMixerRef.current) hostMixerRef.current.update(delta);
      playerMixersRef.current.forEach((m) => m.update(delta));

      // Campfire Flickering Point Light
      if (fireLightRef.current) {
        fireLightRef.current.intensity = 3.2 + Math.sin(elapsed * 12) * 0.4 + Math.sin(elapsed * 23) * 0.25;
        fireLightRef.current.position.x = Math.sin(elapsed * 7) * 0.04;
        fireLightRef.current.position.z = Math.cos(elapsed * 9) * 0.04;
      }

      // Fire sparks rising
      if (fireParticlesRef.current) {
        const posAttr = fireParticlesRef.current.geometry.attributes.position;
        for (let i = 0; i < fireParticleCount; i++) {
          let y = posAttr.getY(i) + delta * 0.95;
          if (y > 1.4) {
            y = 0.2;
            posAttr.setX(i, (Math.random() - 0.5) * 0.4);
            posAttr.setZ(i, (Math.random() - 0.5) * 0.4);
          }
          posAttr.setY(i, y);
        }
        posAttr.needsUpdate = true;
      }

      // Campfire Smoke rising
      if (smokeParticlesRef.current) {
        const sPosAttr = smokeParticlesRef.current.geometry.attributes.position;
        for (let i = 0; i < smokeCount; i++) {
          let y = sPosAttr.getY(i) + delta * 0.5;
          if (y > 4.5) {
            y = 0.4;
            sPosAttr.setX(i, (Math.random() - 0.5) * 0.6);
            sPosAttr.setZ(i, (Math.random() - 0.5) * 0.6);
          }
          sPosAttr.setY(i, y);
        }
        sPosAttr.needsUpdate = true;
      }

      // Celebration Confetti
      if (celebrationParticlesRef.current && celebrationParticlesRef.current.visible) {
        const cPosAttr = celebrationParticlesRef.current.geometry.attributes.position;
        for (let i = 0; i < celebCount; i++) {
          let y = cPosAttr.getY(i) - delta * 1.5;
          if (y < 0.2) y = 9.0;
          cPosAttr.setY(i, y);
        }
        cPosAttr.needsUpdate = true;
      }

      // Floating Ghosts over Tombstones (Bobbing effect)
      playerGroupsRef.current.forEach((grp) => {
        const ghost = grp.getObjectByName('ghostGroup');
        if (ghost) {
          ghost.position.y = 1.6 + Math.sin(elapsed * 2.4 + grp.position.x) * 0.12;
          ghost.rotation.y = elapsed * 0.8;
        }
      });

      // Voice Speaking Rings Pulse Animation
      playerVoiceRingsRef.current.forEach((ring, pid) => {
        const speaking = !!voiceStates[pid]?.isSpeaking;
        ring.visible = speaking;
        if (speaking) {
          const s = 1.0 + Math.sin(elapsed * 12) * 0.18;
          ring.scale.set(s, s, s);
        }
      });

      // Update Selection Ring Position
      if (selectionRingRef.current) {
        if (selectedPlayerId) {
          const selGrp = playerGroupsRef.current.get(selectedPlayerId);
          if (selGrp) {
            selectionRingRef.current.position.set(selGrp.position.x, 0.025, selGrp.position.z);
            selectionRingRef.current.visible = true;
            selectionRingRef.current.rotation.z = elapsed * 1.5;
          }
        } else {
          selectionRingRef.current.visible = false;
        }
      }

      // Update Card Trajectories (Parabolic Flight & Smooth POV Inspection)
      cardTrajectoriesRef.current.forEach((t) => {
        const mesh = t.mesh;
        if (t.phase === 'dealing') {
          if (t.delay > 0) {
            t.delay -= delta;
            mesh.visible = false;
            return;
          }
          mesh.visible = true;
          t.progress = Math.min(1, t.progress + delta * 1.55);
          const prog = t.progress;

          // Parabolic Quadratic Bézier arc from Quản trò's hand to player straw mat
          const p0 = t.startPos;
          const p2 = t.targetPos;
          const midX = (p0.x + p2.x) / 2;
          const midZ = (p0.z + p2.z) / 2;
          const p1 = new THREE.Vector3(midX, Math.max(p0.y, p2.y) + 2.1, midZ);

          const oneMinusT = 1 - prog;
          const curX = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * prog * p1.x + prog * prog * p2.x;
          const curY = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * prog * p1.y + prog * prog * p2.y;
          const curZ = oneMinusT * oneMinusT * p0.z + 2 * oneMinusT * prog * p1.z + prog * prog * p2.z;
          mesh.position.set(curX, curY, curZ);

          // Flight spin around Y axis while keeping card flat/face-down
          const spinY = (1 - prog) * Math.PI * 4;
          mesh.rotation.order = 'YXZ';
          mesh.rotation.set(-Math.PI / 2, t.groundYaw + spinY, 0);

          if (prog >= 1) {
            t.phase = 'dealt';
            mesh.position.copy(t.targetPos);
            mesh.quaternion.copy(t.qGround);
          }
        } else if (t.phase === 'inspecting') {
          t.progress = Math.min(1, t.progress + delta * 3.5);
          const prog = t.progress;
          const ease = prog * prog * (3 - 2 * prog);
          mesh.position.lerpVectors(t.targetPos, t.inspectPos, ease);
          mesh.quaternion.slerpQuaternions(t.qGround, t.qInspect, ease);
        } else if (t.phase === 'facedown') {
          t.progress = Math.min(1, t.progress + delta * 3.5);
          const prog = t.progress;
          const ease = prog * prog * (3 - 2 * prog);
          mesh.position.lerpVectors(t.inspectPos, t.targetPos, ease);
          mesh.quaternion.slerpQuaternions(t.qInspect, t.qGround, ease);
          if (prog >= 1) {
            t.phase = 'dealt';
            mesh.position.copy(t.targetPos);
            mesh.quaternion.copy(t.qGround);
          }
        }
      });

      // ======================================================================
      // LOBBY FREE-ROAM MOVEMENT vs IN-GAME DYNAMIC CIRCLE SEATING
      // ======================================================================
      const activePhase = currentPhaseRef.current;
      const isLobby = activePhase === 'LOBBY';

      if (isLobby) {
        // 1. FREE-ROAM MOVEMENT FOR myPlayer
        const myGroup = myPlayer ? playerGroupsRef.current.get(myPlayer.id) : null;
        const myMixer = myPlayer ? playerMixersRef.current.get(myPlayer.id) : null;

        let moveX = 0;
        let moveZ = 0;
        const keys = keysPressed.current;
        const touch = touchInputRef.current;

        if (keys['w'] || keys['keyw'] || keys['arrowup'] || touch.up) moveZ -= 1;
        if (keys['s'] || keys['keys'] || keys['arrowdown'] || touch.down) moveZ += 1;
        if (keys['a'] || keys['keya'] || keys['arrowleft'] || touch.left) moveX -= 1;
        if (keys['d'] || keys['keyd'] || keys['arrowright'] || touch.right) moveX += 1;

        const isRunning = !!(
          keys['shift'] ||
          keys['shiftleft'] ||
          keys['shiftright'] ||
          touch.run
        );
        const isMoving = moveX !== 0 || moveZ !== 0;

        if (myGroup && cameraRef.current) {
          if (isMoving) {
            // Get camera horizontal forward & right vectors for intuitive direction
            const camForward = new THREE.Vector3();
            cameraRef.current.getWorldDirection(camForward);
            camForward.y = 0;
            if (camForward.lengthSq() > 0.001) camForward.normalize();

            const camRight = new THREE.Vector3();
            camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

            const moveVector = new THREE.Vector3();
            moveVector.addScaledVector(camForward, -moveZ);
            moveVector.addScaledVector(camRight, moveX);
            if (moveVector.lengthSq() > 0.001) moveVector.normalize();

            // Smooth character rotation towards movement direction
            const targetYaw = Math.atan2(moveVector.x, moveVector.z);
            let diff = targetYaw - myPlayerRot.current;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            myPlayerRot.current += diff * Math.min(1, delta * 14.0);
            myGroup.rotation.y = myPlayerRot.current;

            // Speed calculation: Walk ~3.4 m/s, Run ~6.8 m/s
            const speed = isRunning ? 6.8 : 3.4;
            myPlayerPos.current.addScaledVector(moveVector, speed * delta);

            // Boundary constraints: Center campfire hearth (1.25m), Clearing border (13.5m)
            const distCenter = Math.hypot(myPlayerPos.current.x, myPlayerPos.current.z);
            if (distCenter < 1.25) {
              myPlayerPos.current.x = (myPlayerPos.current.x / distCenter) * 1.25;
              myPlayerPos.current.z = (myPlayerPos.current.z / distCenter) * 1.25;
            } else if (distCenter > 13.5) {
              myPlayerPos.current.x = (myPlayerPos.current.x / distCenter) * 13.5;
              myPlayerPos.current.z = (myPlayerPos.current.z / distCenter) * 13.5;
            }

            myGroup.position.set(myPlayerPos.current.x, 0, myPlayerPos.current.z);

            // Play Walk or Run animation
            if (myMixer) {
              playCharacterAnimation(myGroup, myMixer, isRunning ? 'run' : 'walk');
            }
          } else {
            // Idle when standing still
            if (myMixer) {
              playCharacterAnimation(myGroup, myMixer, 'idle');
            }
          }
        }

        // Camera follow myPlayer in Lobby
        if (cameraModeRef.current === 'overview' && cameraRef.current) {
          const targetLook = new THREE.Vector3(myPlayerPos.current.x, 1.1, myPlayerPos.current.z);
          if (controlsRef.current) {
            const prevTarget = controlsRef.current.target.clone();
            controlsRef.current.target.lerp(targetLook, Math.min(1, delta * 5.0));
            const shift = controlsRef.current.target.clone().sub(prevTarget);
            cameraRef.current.position.add(shift);
          }
        } else if (cameraModeRef.current === 'pov' && cameraRef.current) {
          cameraRef.current.position.set(myPlayerPos.current.x, 1.55, myPlayerPos.current.z);
          const lookDir = new THREE.Vector3(
            Math.sin(myPlayerRot.current),
            0,
            Math.cos(myPlayerRot.current)
          );
          cameraRef.current.lookAt(
            myPlayerPos.current.x + lookDir.x * 5.0,
            1.55,
            myPlayerPos.current.z + lookDir.z * 5.0
          );
        }

        // 2. OTHER PLAYERS / BOTS GENTLE WANDERING IN LOBBY
        playerSeats.forEach((seat) => {
          if (seat.player.id === myPlayer?.id) return;
          const grp = playerGroupsRef.current.get(seat.player.id);
          const mixer = playerMixersRef.current.get(seat.player.id);
          if (!grp) return;

          let bot = botStatesRef.current.get(seat.player.id);
          if (!bot) {
            bot = {
              homePos: seat.lobbyPos.clone(),
              targetPos: seat.lobbyPos.clone(),
              isWalking: false,
              timer: 2.0 + Math.random() * 5.0,
            };
            botStatesRef.current.set(seat.player.id, bot);
          }

          bot.timer -= delta;
          if (bot.timer <= 0) {
            if (bot.isWalking) {
              bot.isWalking = false;
              bot.timer = 3.5 + Math.random() * 6.0;
              if (mixer) playCharacterAnimation(grp, mixer, 'idle');
            } else {
              const randAngle = Math.random() * Math.PI * 2;
              const randDist = 0.8 + Math.random() * 1.6;
              bot.targetPos.set(
                bot.homePos.x + Math.cos(randAngle) * randDist,
                0,
                bot.homePos.z + Math.sin(randAngle) * randDist
              );
              const d = Math.hypot(bot.targetPos.x, bot.targetPos.z);
              if (d < 1.4) bot.targetPos.setLength(1.4);
              if (d > 12.0) bot.targetPos.setLength(12.0);

              bot.isWalking = true;
              bot.timer = 2.0 + Math.random() * 3.0;
              if (mixer) playCharacterAnimation(grp, mixer, 'walk');
            }
          }

          if (bot.isWalking) {
            const toTarget = bot.targetPos.clone().sub(grp.position);
            toTarget.y = 0;
            const d = toTarget.length();
            if (d > 0.06) {
              toTarget.normalize();
              const botYaw = Math.atan2(toTarget.x, toTarget.z);
              let dYaw = botYaw - grp.rotation.y;
              while (dYaw < -Math.PI) dYaw += Math.PI * 2;
              while (dYaw > Math.PI) dYaw -= Math.PI * 2;
              grp.rotation.y += dYaw * Math.min(1, delta * 7.0);
              grp.position.addScaledVector(toTarget, 1.6 * delta);
            } else {
              bot.isWalking = false;
              if (mixer) playCharacterAnimation(grp, mixer, 'idle');
            }
          }
        });
      } else {
        // ====================================================================
        // IN-GAME PHASES: ALL 6-15 PLAYERS SEATED IN CIRCLE (SIT_FLOOR_IDLE)
        // ====================================================================
        playerSeats.forEach((seat) => {
          const grp = playerGroupsRef.current.get(seat.player.id);
          const mixer = playerMixersRef.current.get(seat.player.id);
          if (!grp) return;

          // Smoothly lerp towards designated circle seat
          grp.position.lerp(seat.position, Math.min(1, delta * 4.0));

          // Smoothly rotate to face the campfire center (0, 0, 0)
          const targetYaw = Math.atan2(-seat.position.x, -seat.position.z);
          let diff = targetYaw - grp.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          grp.rotation.y += diff * Math.min(1, delta * 8.0);

          // Switch to Sit_Floor_Idle animation for all living players
          if (mixer && seat.player.isAlive) {
            playCharacterAnimation(grp, mixer, 'sit');
          }
        });

        // Overview / Cinematic Camera targeting center campfire council
        if (cameraModeRef.current === 'cinematic' && cameraRef.current) {
          const rotSpeed = 0.12;
          const radius = seatRadius + 4.2;
          cameraRef.current.position.x = Math.sin(elapsed * rotSpeed) * radius;
          cameraRef.current.position.z = Math.cos(elapsed * rotSpeed) * radius;
          cameraRef.current.position.y = 5.2 + Math.sin(elapsed * 0.2) * 0.8;
          cameraRef.current.lookAt(0, 0.6, 0);
        } else if (cameraRef.current) {
          cameraRef.current.position.lerp(targetCamPos.current, delta * 3.5);
          currentLookAt.current.lerp(targetLookAt.current, delta * 3.5);
          if (controlsRef.current && cameraModeRef.current === 'overview') {
            controlsRef.current.target.lerp(currentLookAt.current, delta * 3.5);
          } else if (cameraModeRef.current === 'pov') {
            cameraRef.current.lookAt(currentLookAt.current);
          }
        }
      }

      if (controlsRef.current && cameraModeRef.current === 'overview') {
        controlsRef.current.update();
      }

      renderer.render(scene, camera);
    };

    animate();

    // 16. Window Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ========================================================================
    // CLEANUP MEMORY ON UNMOUNT
    // ========================================================================
    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);

      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }

      if (hostMixerRef.current) {
        hostMixerRef.current.stopAllAction();
        hostMixerRef.current = null;
      }
      playerMixersRef.current.forEach((m) => m.stopAllAction());
      playerMixersRef.current.clear();
      playerGroupsRef.current.clear();
      playerVoiceRingsRef.current.clear();
      playerVoteBadgesRef.current.clear();
      cardMeshesRef.current.clear();

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });

      groundTex.dispose();
      backTex.dispose();

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        if (rendererRef.current.domElement.parentElement) {
          rendererRef.current.domElement.parentElement.removeChild(
            rendererRef.current.domElement
          );
        }
      }
    };
  }, [
    playerSeats,
    seatRadius,
    createTombstoneGroup,
    createPlayerBadgeTexture,
    myPlayer?.id,
    myRole,
    props,
    players,
    voiceStates,
    gameState?.votingState?.voteCounts,
    cameraMode,
    selectedPlayerId,
  ]);

  // ==========================================================================
  // SYNC ENVIRONMENT LIGHTING & SKY TO REAL GAMEPHASE
  // ==========================================================================
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const dirLight = dirLightRef.current;
    const hemiLight = hemiLightRef.current;
    const bloodMoon = bloodMoonRef.current;
    const sunMesh = sunMeshRef.current;
    const celebration = celebrationParticlesRef.current;

    if (currentPhase === 'NIGHT') {
      // Midnight, eerie blood red & deep purple
      scene.background = new THREE.Color(0x060814);
      scene.fog = new THREE.FogExp2(0x060814, 0.032);
      if (dirLight) {
        dirLight.color.set(0x818cf8);
        dirLight.intensity = 0.55;
      }
      if (hemiLight) {
        hemiLight.color.set(0x312e81);
        hemiLight.groundColor.set(0x020617);
        hemiLight.intensity = 0.5;
      }
      if (bloodMoon) bloodMoon.visible = true;
      if (sunMesh) sunMesh.visible = false;
      if (celebration) celebration.visible = false;
    } else if (
      currentPhase === 'DAY_ANNOUNCEMENT' ||
      currentPhase === 'DAY_DISCUSSION' ||
      currentPhase === 'DEATH_REBUTTAL'
    ) {
      // Crisp morning sun
      scene.background = new THREE.Color(0x93c5fd);
      scene.fog = new THREE.FogExp2(0xbfdbfe, 0.012);
      if (dirLight) {
        dirLight.color.set(0xffedd5);
        dirLight.intensity = 2.4;
      }
      if (hemiLight) {
        hemiLight.color.set(0xdbeafe);
        hemiLight.groundColor.set(0x334155);
        hemiLight.intensity = 1.2;
      }
      if (bloodMoon) bloodMoon.visible = false;
      if (sunMesh) sunMesh.visible = true;
      if (celebration) celebration.visible = false;
    } else if (currentPhase === 'VOTING' || currentPhase === 'VOTE_RESOLUTION') {
      // Tense dramatic dusk
      scene.background = new THREE.Color(0x1e1b4b);
      scene.fog = new THREE.FogExp2(0x1e1b4b, 0.022);
      if (dirLight) {
        dirLight.color.set(0xfb923c);
        dirLight.intensity = 1.4;
      }
      if (hemiLight) {
        hemiLight.color.set(0x6366f1);
        hemiLight.groundColor.set(0x1e1b4b);
        hemiLight.intensity = 0.75;
      }
      if (bloodMoon) bloodMoon.visible = false;
      if (sunMesh) sunMesh.visible = false;
      if (celebration) celebration.visible = false;
    } else if (currentPhase === 'GAME_OVER') {
      // Victory Fireworks Celebration
      scene.background = new THREE.Color(0x17152d);
      scene.fog = new THREE.FogExp2(0x17152d, 0.015);
      if (dirLight) {
        dirLight.color.set(0xfde047);
        dirLight.intensity = 2.2;
      }
      if (hemiLight) {
        hemiLight.color.set(0xf43f5e);
        hemiLight.groundColor.set(0x4338ca);
        hemiLight.intensity = 1.1;
      }
      if (bloodMoon) bloodMoon.visible = false;
      if (sunMesh) sunMesh.visible = true;
      if (celebration) celebration.visible = true;
    } else {
      // LOBBY & ROLE_REVEAL: Warm campfire dusk
      scene.background = new THREE.Color(0x0f172a);
      scene.fog = new THREE.FogExp2(0x0f172a, 0.018);
      if (dirLight) {
        dirLight.color.set(0xffedd5);
        dirLight.intensity = 1.2;
      }
      if (hemiLight) {
        hemiLight.color.set(0x38bdf8);
        hemiLight.groundColor.set(0x1e293b);
        hemiLight.intensity = 0.75;
      }
      if (bloodMoon) bloodMoon.visible = false;
      if (sunMesh) sunMesh.visible = false;
      if (celebration) celebration.visible = false;
    }
  }, [currentPhase]);

  // Handle Quick Chat Submit
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !onSendChat) return;
    const channel = currentPhase === 'LOBBY' ? 'LOBBY' : 'DAY_PUBLIC';
    onSendChat(chatInput.trim(), channel);
    setChatInput('');
  };

  // Phase Display Meta
  const phaseMeta = useMemo(() => {
    switch (currentPhase) {
      case 'LOBBY':
        return { label: 'Phòng Chờ Quanh Lửa Trại', color: 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40', icon: Users };
      case 'ROLE_REVEAL':
        return { label: 'Chia Bài Bí Mật', color: 'bg-amber-600/30 text-amber-300 border-amber-500/40', icon: Eye };
      case 'NIGHT':
        return { label: 'Đêm Tối Huyền Bí', color: 'bg-rose-950/70 text-rose-300 border-rose-700/50', icon: Moon };
      case 'DAY_ANNOUNCEMENT':
        return { label: 'Bình Minh Ló Dạng', color: 'bg-amber-500/20 text-amber-200 border-amber-500/30', icon: Sun };
      case 'DAY_DISCUSSION':
        return { label: 'Hội Đồng Thảo Luận', color: 'bg-sky-500/20 text-sky-200 border-sky-500/30', icon: MessageSquare };
      case 'VOTING':
      case 'VOTE_RESOLUTION':
        return { label: 'Bỏ Phiếu Treo Cổ', color: 'bg-amber-600/30 text-amber-300 border-amber-600/50', icon: Gavel };
      case 'DEATH_REBUTTAL':
        return { label: 'Lời Trăn Trối', color: 'bg-purple-950/60 text-purple-300 border-purple-700/40', icon: Skull };
      case 'GAME_OVER':
        return { label: 'Kết Thúc Trận Đấu', color: 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40', icon: Sparkles };
      default:
        return { label: currentPhase, color: 'bg-zinc-800 text-zinc-300 border-zinc-700', icon: Compass };
    }
  }, [currentPhase]);

  const PhaseIcon = phaseMeta.icon;
  const roleDef = myRole ? ROLES_DATABASE[myRole] : null;

  return (
    <div
      className={`relative w-full h-full min-h-[550px] overflow-hidden bg-slate-950 font-sans select-none ${
        isFullscreen ? 'fixed inset-0 z-50' : ''
      } ${props.className || ''}`}
    >
      {/* 3D WebGL Canvas Mount Element */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing outline-none"
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white animate-fade-in">
          <div className="relative mb-5">
            <Flame className="w-14 h-14 text-amber-500 animate-pulse" />
            <Sparkles className="w-6 h-6 text-yellow-300 absolute -top-1 -right-1 animate-spin" />
          </div>
          <h3 className="text-xl font-bold font-serif tracking-wide text-amber-200 mb-2">
            Đang Khởi Tạo Không Gian Làng 3D
          </h3>
          <p className="text-xs text-zinc-400 mb-6 text-center max-w-sm">
            Tải mô hình nhân vật quanh đống lửa trại, hiệu ứng trăng máu và ánh sáng ma mị...
          </p>
          <div className="w-64 h-2 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TOP HUD BAR */}
      {/* ===================================================================== */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
        {/* Left: Room & Phase Status */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {room && (
            <div className="px-3 py-1.5 rounded-xl bg-zinc-900/85 backdrop-blur-md border border-zinc-800 shadow-xl flex items-center gap-2 text-white">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">
                Phòng:
              </span>
              <span className="font-mono font-bold text-xs text-amber-400">
                {room.code}
              </span>
            </div>
          )}

          <div
            className={`px-3 py-1.5 rounded-xl backdrop-blur-md border shadow-xl flex items-center gap-2 text-xs font-semibold ${phaseMeta.color}`}
          >
            <PhaseIcon className="w-4 h-4" />
            <span>{phaseMeta.label}</span>
            {gameState?.roundNumber ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-mono">
                Vòng {gameState.roundNumber}
              </span>
            ) : null}
          </div>
        </div>

        {/* Center: Phase Countdown Timer */}
        {remainingSeconds > 0 && (
          <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-amber-500/40 text-amber-300 shadow-2xl animate-pulse">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="font-mono font-black text-sm tracking-widest">
              {remainingSeconds}s
            </span>
          </div>
        )}

        {/* Right: Camera View Controls & Screen Helpers */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Camera View Switcher Buttons */}
          <div className="flex items-center bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-xl p-0.5 shadow-xl">
            <button
              onClick={() => switchCameraMode('overview')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                cameraMode === 'overview'
                  ? 'bg-amber-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Toàn Cảnh Hội Đồng (Orbit)"
            >
              🌐 Toàn cảnh
            </button>
            <button
              onClick={() => switchCameraMode('pov')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                cameraMode === 'pov'
                  ? 'bg-amber-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Góc Nhìn Của Tôi (POV)"
            >
              👁️ POV
            </button>
            <button
              onClick={() => switchCameraMode('cinematic')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                cameraMode === 'cinematic'
                  ? 'bg-amber-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Góc Quay Điện Ảnh (Cinematic Auto-Rotate)"
            >
              🎬 Điện ảnh
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              const next = soundManager.toggleMute();
              setSoundMuted(next);
            }}
            className="p-2 rounded-xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800 text-zinc-300 hover:text-white transition shadow-xl"
            title={soundMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800 text-zinc-300 hover:text-white transition shadow-xl"
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {props.onSwitchTo2D && (
            <button
              onClick={props.onSwitchTo2D}
              className="px-2.5 py-1.5 rounded-xl bg-violet-950/80 hover:bg-violet-900 border border-violet-800 text-violet-300 text-xs font-bold transition shadow-xl flex items-center gap-1.5"
              title="Chuyển về giao diện 2D"
            >
              <span>📜 2D</span>
            </button>
          )}

          {props.onLeaveRoom && (
            <button
              onClick={props.onLeaveRoom}
              className="p-2 rounded-xl bg-zinc-900/80 hover:bg-rose-950/80 border border-zinc-800 text-zinc-300 hover:text-rose-300 transition shadow-xl"
              title="Rời phòng"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {props.onClose && (
            <button
              onClick={props.onClose}
              className="p-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 transition shadow-xl"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3D PHASE GUIDANCE & USABILITY HUD BANNER */}
      {/* ===================================================================== */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none max-w-[94vw] animate-fade-in">
        <div className="px-4 py-2 rounded-2xl bg-zinc-950/92 backdrop-blur-xl border border-zinc-700/80 shadow-2xl flex items-center gap-2.5 text-xs font-semibold pointer-events-auto">
          {currentPhase === 'LOBBY' && (
            <>
              <Compass className="w-4 h-4 text-amber-400 animate-spin" />
              <span className="text-amber-200">
                Sảnh Chờ: Dùng phím W / A / S / D hoặc Mũi tên để chạy tự do • Giữ Shift chạy nhanh • Nhấp vào nhân vật để tương tác
              </span>
            </>
          )}

          {currentPhase === 'ROLE_REVEAL' && (
            <>
              <Sparkles className="w-4 h-4 text-amber-400 animate-bounce" />
              <span className="text-amber-200">
                Chia Bài Bí Mật: Quản trò vung tay phát bài thần tốc • Bấm <strong className="text-white bg-amber-600/50 px-1.5 py-0.5 rounded border border-amber-500/60">"Cầm xem bài"</strong> (Phím Space / V) để lật mở vai trò bí mật!
              </span>
            </>
          )}

          {currentPhase === 'NIGHT' && (
            <>
              <Moon className="w-4 h-4 text-rose-400 animate-pulse" />
              <span className="text-rose-200">
                Đêm Tối: Làng chìm vào giấc ngủ • <strong className="text-white underline">NHẤP TRỰC TIẾP VÀO MÔ HÌNH 3D</strong> nhân vật quanh đống lửa để dùng năng lực (Sói cắn, Tiên tri soi, Bảo vệ khiên, Phù thủy cứu/độc)!
              </span>
            </>
          )}

          {currentPhase === 'DAY_ANNOUNCEMENT' && (
            <>
              <Sun className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-amber-200">
                Bình Minh Ló Dạng: Trời đã sáng! Kiểm tra xem đêm qua ai đã bị Ma Sói sát hại trong mục Nhật Ký.
              </span>
            </>
          )}

          {currentPhase === 'DAY_DISCUSSION' && (
            <>
              <MessageSquare className="w-4 h-4 text-sky-400 animate-bounce" />
              <span className="text-sky-200">
                Hội Đồng Thảo Luận: Hãy bật Mic nói chuyện hoặc gõ Chat để tranh luận, chất vấn và tìm ra Sói ẩn mình!
              </span>
            </>
          )}

          {currentPhase === 'VOTING' && (
            <>
              <Gavel className="w-4 h-4 text-amber-400 animate-bounce" />
              <span className="text-amber-200">
                Bỏ Phiếu Treo Cổ: <strong className="text-white underline">NHẤP TRỰC TIẾP VÀO MÔ HÌNH 3D</strong> nhân vật bạn muốn treo cổ hôm nay và xác nhận bỏ phiếu!
              </span>
            </>
          )}

          {currentPhase === 'DEATH_REBUTTAL' && (
            <>
              <Skull className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="text-purple-200">
                Lời Trăn Trối: Lắng nghe lời biện hộ cuối cùng của người bị chọn trước khi phán quyết thi hành!
              </span>
            </>
          )}

          {currentPhase === 'VOTE_RESOLUTION' && (
            <>
              <Gavel className="w-4 h-4 text-rose-400" />
              <span className="text-rose-200">
                Phán Quyết Biểu Quyết: Quan sát kết quả công bố hình phạt đối với người bị đa số bỏ phiếu.
              </span>
            </>
          )}

          {currentPhase === 'GAME_OVER' && (
            <>
              <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-emerald-200">
                Kết Thúc Trận Đấu: Chúc mừng phe chiến thắng! Thưởng thức pháo hoa ăn mừng quanh ngọn lửa.
              </span>
            </>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TARGET ACTION CARD (WHEN A PLAYER IS CLICKED IN 3D) */}
      {/* ===================================================================== */}
      {selectedPlayer && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-80 max-w-[90vw] p-4 rounded-3xl bg-zinc-950/90 backdrop-blur-xl border border-zinc-700 shadow-2xl animate-fade-in text-white space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <PlayerAvatar
                player={selectedPlayer}
                size="md"
                online={selectedPlayer.socketConnected}
                speaking={!!voiceStates[selectedPlayer.id]?.isSpeaking}
              />
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                  {selectedPlayer.nickname}
                  {selectedPlayer.id === myPlayer?.id && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-normal">
                      Bạn
                    </span>
                  )}
                </h4>
                <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                  {selectedPlayer.isAlive ? (
                    <span className="text-emerald-400 font-semibold">● Còn sống</span>
                  ) : (
                    <span className="text-rose-400 font-semibold">💀 Đã chết</span>
                  )}
                  {selectedPlayer.isHost && (
                    <span className="text-amber-400 font-semibold">• Chủ phòng</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedPlayerId(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Actions for this Target based on Phase & Role */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-2">
            {/* Night Actions */}
            {currentPhase === 'NIGHT' && selectedPlayer.isAlive && selectedPlayer.id !== myPlayer?.id && (
              <>
                {roleDef?.team === 'WEREWOLF' && (
                  <button
                    onClick={() => {
                      onSubmitAction?.({
                        actionType: 'WOLF_KILL',
                        targetPlayerId: selectedPlayer.id,
                      });
                      setSelectedPlayerId(null);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg"
                  >
                    <Skull className="w-3.5 h-3.5" />
                    <span>Cắn con mồi đêm nay</span>
                  </button>
                )}

                {myRole === 'SEER' && (
                  <button
                    onClick={() => {
                      onSubmitAction?.({
                        actionType: 'SEER_CHECK',
                        targetPlayerId: selectedPlayer.id,
                      });
                      setSelectedPlayerId(null);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Soi danh tính người này</span>
                  </button>
                )}

                {myRole === 'BODYGUARD' && (
                  <button
                    onClick={() => {
                      onSubmitAction?.({
                        actionType: 'BODYGUARD_GUARD',
                        targetPlayerId: selectedPlayer.id,
                      });
                      setSelectedPlayerId(null);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Bảo vệ an toàn đêm nay</span>
                  </button>
                )}

                {myRole === 'WITCH' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        onSubmitAction?.({
                          actionType: 'WITCH_HEAL',
                          targetPlayerId: selectedPlayer.id,
                        });
                        setSelectedPlayerId(null);
                      }}
                      className="py-2 px-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                    >
                      <Heart className="w-3 h-3" />
                      <span>Cứu sống</span>
                    </button>
                    <button
                      onClick={() => {
                        onSubmitAction?.({
                          actionType: 'WITCH_POISON',
                          targetPlayerId: selectedPlayer.id,
                        });
                        setSelectedPlayerId(null);
                      }}
                      className="py-2 px-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                    >
                      <Skull className="w-3 h-3" />
                      <span>Đầu độc</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Voting Action */}
            {currentPhase === 'VOTING' && selectedPlayer.isAlive && selectedPlayer.id !== myPlayer?.id && (
              <button
                onClick={() => {
                  onSubmitVote?.(selectedPlayer.id);
                  setSelectedPlayerId(null);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg"
              >
                <Gavel className="w-4 h-4" />
                <span>Bỏ phiếu treo cổ {selectedPlayer.nickname}</span>
              </button>
            )}

            {/* Lobby Kick Action for Host */}
            {currentPhase === 'LOBBY' && isHostUser && selectedPlayer.id !== myPlayer?.id && (
              <button
                onClick={() => {
                  if (onKickPlayer) onKickPlayer(selectedPlayer.id);
                  else if (context?.kickPlayer) context.kickPlayer(selectedPlayer.id);
                  setSelectedPlayerId(null);
                }}
                className="w-full py-2 px-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Đuổi {selectedPlayer.nickname} khỏi phòng</span>
              </button>
            )}

            {/* Default inspect */}
            <div className="text-[10px] text-zinc-500 text-center">
              Nhấp vào không gian trống để hủy chọn
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MINI GAME LOGS DRAWER (LEFT SIDE) */}
      {/* ===================================================================== */}
      <div className="absolute top-16 left-3 z-20 pointer-events-auto">
        <button
          onClick={() => setShowLogsDrawer(!showLogsDrawer)}
          className="px-3 py-1.5 rounded-xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-2 shadow-xl transition"
        >
          <FileText className="w-3.5 h-3.5 text-amber-400" />
          <span>Nhật ký ({gameState?.logs?.length || 0})</span>
          {showLogsDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showLogsDrawer && (
          <div className="mt-2 w-72 max-h-64 overflow-y-auto p-3 rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 shadow-2xl space-y-2 animate-fade-in text-xs">
            <h5 className="font-bold text-zinc-300 text-[11px] uppercase tracking-wider mb-2">
              Nhật Ký Trận Đấu
            </h5>
            {gameState?.logs && gameState.logs.length > 0 ? (
              gameState.logs.slice(-8).reverse().map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-850 text-zinc-300 text-[11px] leading-relaxed"
                >
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 mb-1">
                    <span>{log.phase}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p>{log.message}</p>
                </div>
              ))
            ) : (
              <div className="text-zinc-500 text-center py-4 text-[11px]">
                Chưa có sự kiện nào được ghi nhận.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* FLOATING QUICK CHAT DRAWER */}
      {/* ===================================================================== */}
      {showChatDrawer && (
        <div className="absolute bottom-20 left-3 z-30 w-80 max-h-96 rounded-3xl bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
          <div className="p-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-xs">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span>Hộp Thoại Trò Chơi</span>
            </div>
            <button
              onClick={() => setShowChatDrawer(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-[160px] max-h-[220px] text-xs">
            {chatMessages.length > 0 ? (
              chatMessages.slice(-20).map((msg) => (
                <div key={msg.id} className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[11px] text-amber-300">
                      {msg.senderName}:
                    </span>
                    <span className="text-[9px] text-zinc-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-zinc-200 text-xs bg-zinc-900/60 p-2 rounded-xl border border-zinc-850">
                    {msg.text}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-zinc-500 text-center py-8">Chưa có tin nhắn nào.</div>
            )}
          </div>

          {/* Chat input */}
          <form onSubmit={handleSendChat} className="p-2 bg-zinc-900/90 border-t border-zinc-800 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Nhập thảo luận..."
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MY CARD DETAIL OVERLAY MODAL */}
      {/* ===================================================================== */}
      {showCardModal && myRole && roleDef && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-sm w-full p-6 rounded-3xl bg-zinc-900 border border-zinc-700 shadow-2xl text-center space-y-4 relative">
            <button
              onClick={() => setShowCardModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-36 h-52 mx-auto rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/60 relative">
              <img
                src={`/cards/${myRole.toLowerCase()}.png`}
                alt={roleDef.vietnameseName}
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
                Vai Trò Bí Mật Của Bạn
              </span>
              <h3 className="text-xl font-bold font-serif text-white">
                {roleDef.vietnameseName}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {roleDef.team === 'WEREWOLF'
                  ? '🐺 Phe Ma Sói'
                  : roleDef.team === 'NEUTRAL'
                  ? '⚖️ Phe Thứ Ba'
                  : '🛡️ Phe Dân Làng'}
              </p>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 p-3 rounded-2xl border border-zinc-800 text-left">
              {roleDef.description}
            </p>

            <button
              onClick={() => setShowCardModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition"
            >
              Đã hiểu & Giữ bí mật
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3D LOBBY MANAGER DOCK / CONTROLS PANEL */}
      {/* ===================================================================== */}
      {currentPhase === 'LOBBY' && (
        <div className="absolute bottom-18 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-2xl p-3 sm:p-4 rounded-3xl bg-zinc-950/92 backdrop-blur-2xl border border-zinc-800 shadow-2xl text-white pointer-events-auto space-y-3 animate-fade-in">
          {/* Top Row: Player Count, Deck Status & Condition Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>👥 Người chơi:</span>
                <span className="font-mono text-amber-300 font-black">{players.length} / 15</span>
                <span className="text-[10px] text-zinc-400 font-normal">(Tối thiểu 6)</span>
              </span>

              <span className="text-zinc-700 hidden sm:inline">•</span>

              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1 hidden sm:flex">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Bộ bài:</span>
                <span className={`font-mono font-bold ${isDeckBalanced ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {totalCards} lá
                </span>
                {isDeckBalanced && <span className="text-[10px] text-emerald-400 font-bold">✓ Cân bằng</span>}
              </span>
            </div>

            {/* Condition Warning or Success Badge */}
            <div>
              {players.length < 6 ? (
                <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Cần tối thiểu 6 người để bắt đầu!</span>
                </span>
              ) : !isDeckBalanced ? (
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cần {players.length} thẻ bài (hiện {totalCards})</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-500/30">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sẵn sàng vào trận!</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Row */}
          {isHostUser ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Add Bot button */}
                <button
                  type="button"
                  onClick={handleAddBot}
                  disabled={players.length >= 15}
                  className="px-3 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 disabled:opacity-40 text-xs font-bold text-zinc-100 flex items-center gap-1.5 transition shadow active:scale-95"
                  title="Thêm Bot Test vào làng 3D (mô hình 3D xuất hiện ngay lập tức)"
                >
                  <Bot className="w-4 h-4 text-cyan-400" />
                  <span>🤖 + Thêm Bot</span>
                </button>

                {/* Fill to 6 Players button */}
                <button
                  type="button"
                  onClick={handleFillTo6}
                  disabled={players.length >= 6 || isFillingBots}
                  className="px-3 py-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 disabled:opacity-40 border border-indigo-700/60 text-xs font-bold text-indigo-200 flex items-center gap-1.5 transition shadow active:scale-95"
                  title="Tự động gọi thêm bot cho đủ tối thiểu 6 người chơi để bắt đầu nhanh"
                >
                  <Zap className="w-4 h-4 text-indigo-300" />
                  <span>{isFillingBots ? '⚡ Đang thêm...' : '⚡ Lấp Đầy 6 Người'}</span>
                </button>

                {/* Auto Balance Deck button */}
                <button
                  type="button"
                  onClick={handleAutoBalanceDeck}
                  className="px-3 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-xs font-bold text-purple-200 flex items-center gap-1.5 transition shadow active:scale-95"
                  title="Tự động cân bằng bộ bài phù hợp với số lượng người chơi (6 - 15 thẻ bài)"
                >
                  <Layers className="w-4 h-4 text-purple-300" />
                  <span>🃏 Cân Bằng Bộ Bài</span>
                </button>

                {/* Custom Deck Builder */}
                <button
                  type="button"
                  onClick={() => setShowDeckBuilder(true)}
                  className="px-2.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1 transition"
                  title="Mở trình tùy chỉnh bộ bài chi tiết"
                >
                  <span>🛠️ Tùy Chỉnh</span>
                </button>
              </div>

              {/* Start Game Button for Host */}
              <button
                type="button"
                onClick={() => {
                  if (canStartGame) {
                    soundManager.playClick();
                    if (props.onStartGame) props.onStartGame();
                    else if (context?.startGame) context.startGame();
                  }
                }}
                disabled={!canStartGame}
                className={`px-5 py-2 rounded-2xl font-black text-xs flex items-center gap-2 transition shadow-xl ${
                  canStartGame
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white border border-emerald-300 shadow-emerald-500/40 animate-pulse cursor-pointer'
                    : 'bg-zinc-900/90 border border-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                }`}
                title={
                  !canStartGame
                    ? players.length < 6
                      ? 'Cần tối thiểu 6 người để bắt đầu'
                      : !isDeckBalanced
                      ? 'Cần bấm "Cân Bằng Bộ Bài" trước khi bắt đầu'
                      : 'Chưa đủ điều kiện bắt đầu'
                    : 'Bắt đầu trò chơi và xếp chỗ ngồi vào vòng tròn!'
                }
              >
                <Sparkles className={`w-4 h-4 ${canStartGame ? 'text-amber-300' : 'text-zinc-600'}`} />
                <span>🔥 BẮT ĐẦU GAME</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-zinc-400 py-1">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                <span>Đang chờ Chủ phòng thiết lập và bắt đầu trận đấu...</span>
              </span>
              <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                Khách
              </span>
            </div>
          )}
        </div>
      )}

      {/* Deck Builder Modal */}
      {showDeckBuilder && room && (
        <DeckBuilderModal
          isOpen={showDeckBuilder}
          onClose={() => setShowDeckBuilder(false)}
          currentDeck={room.deck}
          playerCount={players.length}
          settings={room.settings}
          onSaveDeck={(newDeck) => {
            if (onUpdateDeck) onUpdateDeck(newDeck);
            setShowDeckBuilder(false);
          }}
          onUpdateSettings={(newSettings) => {
            context?.updateSettings?.(newSettings);
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* 3D CARD INSPECT FLOATING HUD (ROLE_REVEAL PHASE) */}
      {/* ===================================================================== */}
      {currentPhase === 'ROLE_REVEAL' && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2.5 pointer-events-auto animate-fade-in">
          <div className="px-4 py-1.5 rounded-full bg-zinc-950/90 backdrop-blur-xl border border-amber-500/40 text-amber-200 text-xs font-bold shadow-2xl flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>
              {isCardInspecting
                ? 'Góc nhìn POV: Bạn đang xem thẻ bài vai trò bí mật'
                : 'Quản trò đã phát bài! Bấm xem vai trò hoặc chạm vào lá bài'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isCardInspecting ? (
              <button
                type="button"
                onClick={handlePickAndInspectCard}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white font-black text-sm flex items-center gap-2.5 shadow-2xl shadow-amber-500/40 border border-yellow-300 animate-pulse transition active:scale-95 cursor-pointer"
              >
                <Eye className="w-5 h-5 text-yellow-100" />
                <span>👁️ Cầm Xem Vai Trò Của Bạn</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePlaceCardFaceDown}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-800 hover:bg-zinc-700 text-amber-300 font-black text-sm flex items-center gap-2.5 shadow-2xl border border-amber-500/60 transition active:scale-95 cursor-pointer"
              >
                <ChevronDown className="w-5 h-5 text-amber-400" />
                <span>⬇️ Đặt Úp Bài Xuống Chiếu</span>
              </button>
            )}

            <button
              type="button"
              onClick={triggerDealCards}
              className="p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition shadow-xl"
              title="Chia Lại Bài (3D Parabol)"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* BOTTOM CONTROLS DOCK */}
      {/* ===================================================================== */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 pointer-events-auto">
        {/* Toggle Mic */}
        {toggleMic && (
          <button
            onClick={() => toggleMic()}
            className={`px-4 py-2.5 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center gap-2 text-xs font-bold transition ${
              !isMyMicMuted
                ? 'bg-emerald-600/90 hover:bg-emerald-500 border-emerald-400 text-white animate-pulse'
                : 'bg-zinc-900/85 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
            }`}
          >
            {!isMyMicMuted ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-rose-400" />}
            <span className="hidden sm:inline">
              {!isMyMicMuted ? 'Đang bật Mic' : 'Bật Mic'}
            </span>
          </button>
        )}

        {/* Toggle Deafen */}
        {toggleDeafen && (
          <button
            onClick={() => toggleDeafen()}
            className={`p-2.5 rounded-2xl backdrop-blur-xl border shadow-2xl transition ${
              isMyDeafened
                ? 'bg-rose-950/90 border-rose-700 text-rose-300'
                : 'bg-zinc-900/85 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
            }`}
            title={isMyDeafened ? 'Bật âm thanh hội thoại' : 'Tắt tiếng phòng'}
          >
            {isMyDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}

        {/* Inspect Role Card in 3D */}
        {myRole && (
          <button
            onClick={handleInspectCardToggle}
            className={`px-4 py-2.5 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center gap-2 text-xs font-bold transition ${
              isCardInspecting
                ? 'bg-zinc-900/95 border-amber-500/60 text-amber-300 hover:bg-zinc-850'
                : 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 border-amber-300 text-white shadow-amber-500/30'
            }`}
          >
            {isCardInspecting ? (
              <>
                <ChevronDown className="w-4 h-4 text-amber-400" />
                <span>⬇️ Đặt Úp Bài Xuống Chiếu</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-yellow-200" />
                <span>👁️ Cầm Xem Vai Trò Của Bạn</span>
              </>
            )}
          </button>
        )}

        {/* Open Chat Drawer */}
        <button
          onClick={() => setShowChatDrawer(!showChatDrawer)}
          className="p-2.5 rounded-2xl bg-zinc-900/85 hover:bg-zinc-800 backdrop-blur-xl border border-zinc-800 text-zinc-300 hover:text-white shadow-2xl transition"
          title="Mở trò chuyện"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>

      {/* Lobby Free-Roam Movement Guide Banner */}
      {currentPhase === 'LOBBY' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-fade-in">
          <div className="px-4 py-1.5 rounded-full bg-zinc-950/80 backdrop-blur-md border border-amber-500/40 text-amber-200 text-xs font-semibold shadow-2xl flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400 animate-spin" />
            <span>Sảnh Chờ: Dùng phím W / A / S / D hoặc Mũi tên để chạy tự do • Giữ Shift chạy nhanh</span>
          </div>
        </div>
      )}

      {/* Virtual D-Pad for Mobile / Touch Navigation in Lobby */}
      {currentPhase === 'LOBBY' && (
        <div className="absolute bottom-20 left-4 z-20 flex flex-col items-center gap-1.5 select-none pointer-events-auto">
          <div className="grid grid-cols-3 gap-1 bg-zinc-950/80 p-2 rounded-2xl border border-zinc-800/80 backdrop-blur-md shadow-2xl">
            <div />
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); touchInputRef.current.up = true; }}
              onPointerUp={(e) => { e.preventDefault(); touchInputRef.current.up = false; }}
              onPointerLeave={(e) => { e.preventDefault(); touchInputRef.current.up = false; }}
              className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-amber-600 active:bg-amber-500 text-white font-bold flex items-center justify-center text-sm transition shadow border border-zinc-700 active:scale-95"
            >
              ▲
            </button>
            <div />
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); touchInputRef.current.left = true; }}
              onPointerUp={(e) => { e.preventDefault(); touchInputRef.current.left = false; }}
              onPointerLeave={(e) => { e.preventDefault(); touchInputRef.current.left = false; }}
              className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-amber-600 active:bg-amber-500 text-white font-bold flex items-center justify-center text-sm transition shadow border border-zinc-700 active:scale-95"
            >
              ◀
            </button>
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); touchInputRef.current.down = true; }}
              onPointerUp={(e) => { e.preventDefault(); touchInputRef.current.down = false; }}
              onPointerLeave={(e) => { e.preventDefault(); touchInputRef.current.down = false; }}
              className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-amber-600 active:bg-amber-500 text-white font-bold flex items-center justify-center text-sm transition shadow border border-zinc-700 active:scale-95"
            >
              ▼
            </button>
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); touchInputRef.current.right = true; }}
              onPointerUp={(e) => { e.preventDefault(); touchInputRef.current.right = false; }}
              onPointerLeave={(e) => { e.preventDefault(); touchInputRef.current.right = false; }}
              className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-amber-600 active:bg-amber-500 text-white font-bold flex items-center justify-center text-sm transition shadow border border-zinc-700 active:scale-95"
            >
              ▶
            </button>
          </div>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              touchInputRef.current.run = true;
              setIsTouchRunning(true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              touchInputRef.current.run = false;
              setIsTouchRunning(false);
            }}
            onPointerLeave={(e) => {
              e.preventDefault();
              touchInputRef.current.run = false;
              setIsTouchRunning(false);
            }}
            className={`px-3 py-1 rounded-xl text-[11px] font-bold transition shadow border ${
              isTouchRunning
                ? 'bg-amber-600 text-white border-amber-400 scale-95'
                : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:text-white'
            }`}
          >
            ⚡ Giữ chạy nhanh (Shift)
          </button>
        </div>
      )}
    </div>
  );
};

export default Game3DRoomView;
