import React, { useEffect, useRef, useState, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  Camera,
  Play,
  CheckCircle2,
  X,
  Layers,
  Sun,
  Flame,
  Info,
  ChevronRight,
  Maximize2,
  Minimize2,
  Compass
} from 'lucide-react';
import { ROLES_DATABASE } from '../data/rolesData';
import { RoleId } from '../types';

export type DayStep = 'IDLE' | 'DEALING' | 'PEEKING' | 'PLACED_DOWN';
export type CameraViewMode = 'overview' | 'first_person';
export type SequencePhase = 'ready' | 'dealing' | 'dealt' | 'inspecting' | 'facedown';
export type CameraMode = 'overview' | 'pov';

export interface PlayerSeat {
  id: string;
  name: string;
  roleId: RoleId;
  roleName: string;
  modelUrl: string;
  team: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  cardTargetPos: THREE.Vector3;
  cardInspectPos: THREE.Vector3;
  cardMesh?: THREE.Mesh;
}

// Seat positions for 6 players in horseshoe circle facing center (0,0,0) and Host at (0, 0, -4.1)
export const SEATS_CONFIG: Array<{
  id: string;
  name: string;
  roleId: RoleId;
  roleName: string;
  modelUrl: string;
  team: string;
  x: number;
  z: number;
}> = [
  {
    id: 'p1',
    name: 'Bạn (P1)',
    roleId: 'SEER',
    roleName: 'Tiên Tri',
    modelUrl: '/models/Knight.glb',
    team: 'Phe Dân Làng',
    x: 0.95,
    z: 3.25,
  },
  {
    id: 'p2',
    name: 'Dân Làng A (P2)',
    roleId: 'VILLAGER',
    roleName: 'Dân Làng',
    modelUrl: '/models/Mage.glb',
    team: 'Phe Dân Làng',
    x: 2.85,
    z: 1.65,
  },
  {
    id: 'p3',
    name: 'Thợ Săn B (P3)',
    roleId: 'HUNTER',
    roleName: 'Thợ Săn',
    modelUrl: '/models/Rogue.glb',
    team: 'Phe Dân Làng',
    x: 2.95,
    z: -1.35,
  },
  {
    id: 'p4',
    name: 'Kẻ Đáng Ngờ (P4)',
    roleId: 'WEREWOLF',
    roleName: 'Ma Sói',
    modelUrl: '/models/Knight.glb',
    team: 'Phe Ma Sói',
    x: -2.95,
    z: -1.35,
  },
  {
    id: 'p5',
    name: 'Phù Thủy C (P5)',
    roleId: 'WITCH',
    roleName: 'Phù Thủy',
    modelUrl: '/models/Mage.glb',
    team: 'Phe Dân Làng',
    x: -2.85,
    z: 1.65,
  },
  {
    id: 'p6',
    name: 'Hộ Vệ D (P6)',
    roleId: 'BODYGUARD',
    roleName: 'Bảo Vệ',
    modelUrl: '/models/Rogue.glb',
    team: 'Phe Dân Làng',
    x: -0.95,
    z: 3.25,
  },
];

export interface DayPhase3DViewerHandle {
  dealCards: () => void;
  pickAndInspectCards: () => void;
  placeCardsFaceDown: () => void;
  resetCards: () => void;
  switchCameraMode: (mode: CameraMode) => void;
  runAutoSequence: () => void;
}

export interface DayPhase3DViewerProps {
  // Controlled Step & Camera from modal wrapper
  currentStep?: DayStep;
  cameraView?: CameraViewMode;
  selectedRole?: RoleId | string;
  onStepChange?: (step: DayStep) => void;
  onCameraChange?: (mode: CameraViewMode) => void;
  onCardClick?: (seat: PlayerSeat) => void;
  showOverlayControls?: boolean;
  showInternalControls?: boolean;
  onPhaseChange?: (phase: SequencePhase) => void;
  onCameraModeChange?: (mode: CameraMode) => void;
  privacyShieldEnabled?: boolean;

  // Standalone game integration props
  onClose?: () => void;
  className?: string;
  playerRole?: RoleId;
  playerName?: string;
  isHost?: boolean;
  autoStartSequence?: boolean;
}

export const DayPhase3DViewer = forwardRef<DayPhase3DViewerHandle, DayPhase3DViewerProps>((props, ref) => {
  const {
    currentStep,
    cameraView,
    selectedRole,
    onStepChange,
    onCameraChange,
    onCardClick,
    showOverlayControls = true,
    showInternalControls,
    onPhaseChange,
    onCameraModeChange,
    privacyShieldEnabled = true,
    onClose,
    className = '',
    playerRole = 'SEER',
    playerName = 'Bạn',
    isHost = true,
    autoStartSequence = false,
  } = props;
  const mountRef = useRef<HTMLDivElement>(null);

  // Determine effective primary role (controlled selectedRole or playerRole)
  const effectiveRole = (selectedRole as RoleId) || playerRole;

  // Internal states
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(10);
  const [internalPhase, setInternalPhase] = useState<SequencePhase>('ready');
  const [internalCameraMode, setInternalCameraMode] = useState<CameraMode>('overview');
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Quản trò đang cầm cỗ bài trên tay.');
  const [soundEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Three.js instances references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // 3D entities
  const hostModelRef = useRef<THREE.Group | null>(null);
  const hostMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const hostActionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const playerMixersRef = useRef<THREE.AnimationMixer[]>([]);
  const deckMeshRef = useRef<THREE.Group | null>(null);
  const cardsMeshesRef = useRef<THREE.Mesh[]>([]);
  const cardTrajectoriesRef = useRef<
    Array<{
      mesh: THREE.Mesh;
      seatId: string;
      isPlayer: boolean;
      startPos: THREE.Vector3;
      targetPos: THREE.Vector3;
      inspectPos: THREE.Vector3;
      groundYaw: number;
      qGround: THREE.Quaternion;
      qInspect: THREE.Quaternion;
      progress: number;
      delay: number;
      phase: SequencePhase;
    }>
  >([]);

  // Camera targets for smooth interpolation
  const targetCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 5.2, 7.8));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.4, 0));
  const currentLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.4, 0));

  // Sound effect helper
  const playSound = useCallback((file: string) => {
    try {
      const audio = new Audio(file);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // Audio playback might be restricted before interaction
    }
  }, []);

  // Initialize Seats configuration with player override
  const seats: PlayerSeat[] = useMemo(() => {
    return SEATS_CONFIG.map((seat, index) => {
      const isPlayer = index === 0;
      const seatRoleId = isPlayer ? effectiveRole : seat.roleId;
      const roleDef = ROLES_DATABASE[seatRoleId];
      const roleName = roleDef ? roleDef.vietnameseName : seat.roleName;
      const roleTeam = roleDef
        ? roleDef.team === 'WEREWOLF'
          ? 'Phe Ma Sói'
          : 'Phe Dân Làng'
        : seat.team;

      const pos = new THREE.Vector3(seat.x, 0, seat.z);
      const lookAt = new THREE.Vector3(0, 0, 0);

      // Card on ground right in front of seated player (0.015m flush with mat/ground)
      const cardTargetPos = new THREE.Vector3(seat.x * 0.72, 0.015, seat.z * 0.72);

      // Card inspected: floating in front of chest/face
      const cardInspectPos = isPlayer
        ? new THREE.Vector3(0.655, 1.05, 2.24)
        : new THREE.Vector3(seat.x * 0.75, 0.95, seat.z * 0.75);

      return {
        id: seat.id,
        name: isPlayer ? playerName : seat.name,
        roleId: seatRoleId,
        roleName,
        modelUrl: seat.modelUrl,
        team: roleTeam,
        position: pos,
        lookAt,
        cardTargetPos,
        cardInspectPos,
      };
    });
  }, [effectiveRole, playerName]);

  // Host position
  const hostPosition = useMemo(() => new THREE.Vector3(0, 0, -4.1), []);
  const hostDeckHandPos = useMemo(() => new THREE.Vector3(0.38, 1.15, -3.75), []);

  const updatePhase = useCallback((phase: SequencePhase) => {
    setInternalPhase(phase);
    onPhaseChange?.(phase);
  }, [onPhaseChange]);

  // ============================================================
  // CAMERA SWITCHING
  // ============================================================
  const switchCameraMode = useCallback(
    (mode: CameraMode) => {
      setInternalCameraMode(mode);
      onCameraModeChange?.(mode);
      if (mode === 'overview') {
        targetCameraPos.current.set(0, 5.2, 7.8);
        targetLookAt.current.set(0, 0.4, 0);
        if (controlsRef.current) {
          controlsRef.current.enabled = true;
          controlsRef.current.enableRotate = true;
          controlsRef.current.enablePan = true;
          controlsRef.current.target.set(0, 0.4, 0);
        }
        if (onCameraChange) onCameraChange('overview');
      } else {
        // POV cá nhân của P1: tầm mắt tự nhiên, hướng thẳng vào lá bài riêng tư
        targetCameraPos.current.set(0.95, 1.38, 3.25);
        if (internalPhase === 'inspecting') {
          targetLookAt.current.set(0.655, 1.05, 2.24);
        } else {
          targetLookAt.current.set(0, 0.85, 0);
        }
        if (controlsRef.current) {
          controlsRef.current.enabled = false;
        }
        if (onCameraChange) onCameraChange('first_person');
      }
    },
    [internalPhase, onCameraChange, onCameraModeChange]
  );

  // Sync external cameraView prop
  useEffect(() => {
    if (cameraView) {
      if (cameraView === 'overview' && internalCameraMode !== 'overview') {
        switchCameraMode('overview');
      } else if (cameraView === 'first_person' && internalCameraMode !== 'pov') {
        switchCameraMode('pov');
      }
    }
  }, [cameraView, internalCameraMode, switchCameraMode]);

  // ============================================================
  // CHOREOGRAPHY ANIMATION ACTIONS
  // ============================================================

  // Step 1 & 2: Deal Cards from Host to Each Player
  const dealCards = useCallback(() => {
    if (!sceneRef.current) return;
    updatePhase('dealing');
    setStatusMessage('Quản trò vung tay chia bài thần tốc theo đường cong parabol...');

    // Host deal animation: trigger Throw / Spellcast_Raise / Interact
    if (hostActionsRef.current['throw']) {
      const act = hostActionsRef.current['throw'];
      act.reset().setLoop(THREE.LoopOnce, 1).play();
    } else if (hostActionsRef.current['interact']) {
      const act = hostActionsRef.current['interact'];
      act.reset().setLoop(THREE.LoopOnce, 1).play();
    }

    if (soundEnabled) playSound('/click.mp3');

    // Launch cards with staggered delay
    cardTrajectoriesRef.current.forEach((t, i) => {
      t.phase = 'dealing';
      t.progress = 0;
      t.startPos.copy(hostDeckHandPos);
      t.delay = i * 0.16;
    });

    if (onStepChange) onStepChange('DEALING');

    setTimeout(() => {
      updatePhase('dealt');
      setStatusMessage('Các lá bài đã hạ cánh úp xuống chiếu song song mặt đất trước mặt mỗi người chơi.');
      if (soundEnabled) playSound('/card-flip.mp3');
    }, 1800);
  }, [hostDeckHandPos, soundEnabled, playSound, onStepChange, updatePhase]);

  // Step 3: Pick & Inspect Cards (Face Up in POV)
  const pickAndInspectCards = useCallback(() => {
    // Tự động chuyển ngay sang góc cam cá nhân (P1 POV)
    switchCameraMode('pov');
    targetLookAt.current.set(0.655, 1.05, 2.24);

    updatePhase('inspecting');
    setStatusMessage('Góc nhìn POV: Bạn đang cầm thẻ bài lên xem vai trò bí mật.');
    if (soundEnabled) playSound('/card-flip.mp3');

    cardTrajectoriesRef.current.forEach((t) => {
      t.phase = 'inspecting';
      t.progress = 0;
    });

    if (onStepChange) onStepChange('PEEKING');
  }, [soundEnabled, playSound, onStepChange, updatePhase, switchCameraMode]);

  // Step 4: Place Cards Face-Down onto Mat
  const placeCardsFaceDown = useCallback(() => {
    updatePhase('facedown');
    setStatusMessage('Người chơi đặt úp lá bài xuống chiếu, giữ kín danh tính.');
    if (soundEnabled) playSound('/card-flip.mp3');

    if (internalCameraMode === 'pov') {
      targetLookAt.current.set(0, 0.75, 0);
    }

    cardTrajectoriesRef.current.forEach((t) => {
      t.phase = 'facedown';
      t.progress = 0;
    });

    if (onStepChange) onStepChange('PLACED_DOWN');
  }, [internalCameraMode, soundEnabled, playSound, onStepChange, updatePhase]);

  // Reset: Return cards back to Host deck
  const resetCards = useCallback(() => {
    updatePhase('ready');
    setStatusMessage('Thu bài về cỗ bài trên tay Quản trò.');
    if (soundEnabled) playSound('/click.mp3');

    if (internalCameraMode === 'pov') {
      targetLookAt.current.set(0, 1.15, -4.1);
    }

    cardTrajectoriesRef.current.forEach((t) => {
      t.phase = 'ready';
      t.progress = 0;
      t.mesh.position.copy(hostDeckHandPos);
      t.mesh.quaternion.copy(t.qGround);
      t.mesh.visible = false;
    });

    if (onStepChange) onStepChange('IDLE');
  }, [hostDeckHandPos, internalCameraMode, soundEnabled, playSound, onStepChange, updatePhase]);

  // Sync external currentStep prop
  useEffect(() => {
    if (!currentStep) return;
    if (currentStep === 'IDLE' && internalPhase !== 'ready') {
      resetCards();
    } else if (currentStep === 'DEALING' && internalPhase !== 'dealing' && internalPhase !== 'dealt') {
      dealCards();
    } else if (currentStep === 'PEEKING' && internalPhase !== 'inspecting') {
      pickAndInspectCards();
    } else if (currentStep === 'PLACED_DOWN' && internalPhase !== 'facedown') {
      placeCardsFaceDown();
    }
  }, [currentStep, internalPhase, resetCards, dealCards, pickAndInspectCards, placeCardsFaceDown]);

  // Run full Auto Sequence Demo
  const runAutoSequence = useCallback(() => {
    setIsAutoPlaying(true);
    resetCards();

    setTimeout(() => {
      dealCards();

      setTimeout(() => {
        switchCameraMode('pov');
        pickAndInspectCards();

        setTimeout(() => {
          placeCardsFaceDown();

          setTimeout(() => {
            switchCameraMode('overview');
            setIsAutoPlaying(false);
          }, 3000);
        }, 4000);
      }, 2400);
    }, 600);
  }, [resetCards, dealCards, pickAndInspectCards, placeCardsFaceDown, switchCameraMode]);

  // Expose imperative handle to parent components
  useImperativeHandle(
    ref,
    () => ({
      dealCards,
      pickAndInspectCards,
      placeCardsFaceDown,
      resetCards,
      switchCameraMode,
      runAutoSequence,
    }),
    [dealCards, pickAndInspectCards, placeCardsFaceDown, resetCards, switchCameraMode, runAutoSequence]
  );

  // ============================================================
  // THREE.JS SETUP & MAIN LIFECYCLE
  // ============================================================
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xafe1f8); // Crisp warm morning sky
    scene.fog = new THREE.FogExp2(0xcde8f7, 0.015);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(0, 5.2, 7.8);
    camera.lookAt(0, 0.4, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 2.0;
    controls.maxDistance = 22.0;
    controls.target.set(0, 0.4, 0);
    controlsRef.current = controls;

    // 5. Lighting (Warm Daylight Village)
    const sunLight = new THREE.DirectionalLight(0xfff5d6, 2.5);
    sunLight.position.set(11, 18, 9);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 45;
    const d = 12;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xe8f4fc, 0x4f783c, 1.25);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xfffbf2, 0.4);
    scene.add(ambientLight);

    // Sun disc in the sky
    const sunGeom = new THREE.SphereGeometry(2.5, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff9e6 });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.position.set(30, 48, 26);
    scene.add(sunMesh);

    // 6. Village Landscape & Ground
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#4c8438';
      ctx.fillRect(0, 0, 512, 512);

      for (let i = 0; i < 4000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = Math.random() * 3 + 1;
        ctx.fillStyle = Math.random() > 0.5 ? '#5b9845' : '#3e6f2c';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 220);
      grad.addColorStop(0, 'rgba(128, 102, 68, 0.45)');
      grad.addColorStop(0.55, 'rgba(112, 92, 58, 0.25)');
      grad.addColorStop(1, 'rgba(76, 132, 56, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
    }

    const groundTex = new THREE.CanvasTexture(canvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(8, 8);

    const groundGeom = new THREE.PlaneGeometry(55, 55, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.88,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Campfire Hearth in Center
    const hearthGroup = new THREE.Group();
    const stoneGeom = new THREE.DodecahedronGeometry(0.24, 1);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6e6e66, roughness: 0.85 });
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const stone = new THREE.Mesh(stoneGeom, stoneMat);
      stone.position.set(Math.cos(angle) * 0.85, 0.1, Math.sin(angle) * 0.85);
      stone.rotation.set(Math.random(), Math.random(), Math.random());
      stone.scale.set(1 + Math.random() * 0.3, 0.8 + Math.random() * 0.3, 1 + Math.random() * 0.3);
      stone.castShadow = true;
      stone.receiveShadow = true;
      hearthGroup.add(stone);
    }

    const logGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.85, 8);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x482d1c, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(logGeom, logMat);
      log.position.set((Math.random() - 0.5) * 0.3, 0.12, (Math.random() - 0.5) * 0.3);
      log.rotation.set(0.3, (i * Math.PI) / 2.5, 1.2);
      log.castShadow = true;
      hearthGroup.add(log);
    }
    scene.add(hearthGroup);

    // Smoke particles
    const smokeCount = 35;
    const smokePositions = new Float32Array(smokeCount * 3);
    for (let i = 0; i < smokeCount; i++) {
      smokePositions[i * 3] = (Math.random() - 0.5) * 0.5;
      smokePositions[i * 3 + 1] = 0.2 + Math.random() * 3.5;
      smokePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    const smokeGeom = new THREE.BufferGeometry();
    smokeGeom.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    const smokeMat = new THREE.PointsMaterial({
      color: 0xdedede,
      size: 0.18,
      transparent: true,
      opacity: 0.3,
    });
    const smokePoints = new THREE.Points(smokeGeom, smokeMat);
    scene.add(smokePoints);

    // Dust particles
    const dustCount = 60;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 16;
      dustPositions[i * 3 + 1] = 0.5 + Math.random() * 4.5;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    const dustGeom = new THREE.BufferGeometry();
    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xfff0aa,
      size: 0.08,
      transparent: true,
      opacity: 0.65,
    });
    const dustPoints = new THREE.Points(dustGeom, dustMat);
    scene.add(dustPoints);

    // Perimeter Trees
    const treeTrunkGeom = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 8);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4e3620, roughness: 0.9 });
    const treeFoliageGeom = new THREE.ConeGeometry(1.6, 3.2, 8);
    const treeFoliageMat = new THREE.MeshStandardMaterial({ color: 0x2e6638, roughness: 0.8 });

    const treePositions = [
      [-9, -9],
      [9, -9],
      [-11, 4],
      [11, 4],
      [-7, 10],
      [7, 10],
    ];
    treePositions.forEach(([tx, tz]) => {
      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(treeTrunkGeom, treeTrunkMat);
      trunk.position.y = 0.8;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const foliage1 = new THREE.Mesh(treeFoliageGeom, treeFoliageMat);
      foliage1.position.y = 2.4;
      foliage1.castShadow = true;
      treeGroup.add(foliage1);

      const foliage2 = new THREE.Mesh(treeFoliageGeom, treeFoliageMat);
      foliage2.position.y = 3.6;
      foliage2.scale.set(0.75, 0.75, 0.75);
      foliage2.castShadow = true;
      treeGroup.add(foliage2);

      treeGroup.position.set(tx, 0, tz);
      scene.add(treeGroup);
    });

    // Seating Straw Mats
    const matGeom = new THREE.CylinderGeometry(0.72, 0.72, 0.035, 32);
    const matMat = new THREE.MeshStandardMaterial({
      color: 0xd9b379,
      roughness: 0.8,
      metalness: 0.05,
    });
    seats.forEach((seat) => {
      const mat = new THREE.Mesh(matGeom, matMat);
      mat.position.set(seat.position.x, 0.018, seat.position.z);
      mat.receiveShadow = true;
      scene.add(mat);
    });

    // Host Dais & Deck Podium
    const daisGeom = new THREE.CylinderGeometry(1.0, 1.1, 0.18, 32);
    const daisMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.85 });
    const dais = new THREE.Mesh(daisGeom, daisMat);
    dais.position.set(hostPosition.x, 0.09, hostPosition.z);
    dais.receiveShadow = true;
    scene.add(dais);

    const stumpGeom = new THREE.CylinderGeometry(0.35, 0.4, 0.95, 16);
    const stumpMat = new THREE.MeshStandardMaterial({ color: 0x422d19, roughness: 0.9 });
    const stump = new THREE.Mesh(stumpGeom, stumpMat);
    stump.position.set(hostDeckHandPos.x, 0.47, hostDeckHandPos.z);
    stump.castShadow = true;
    stump.receiveShadow = true;
    scene.add(stump);

    const deckGroup = new THREE.Group();
    deckMeshRef.current = deckGroup;
    const deckBlockGeom = new THREE.BoxGeometry(0.55, 0.14, 0.8);
    const deckBlockMat = new THREE.MeshStandardMaterial({
      color: 0x221a2e,
      roughness: 0.4,
      metalness: 0.3,
    });
    const deckBlock = new THREE.Mesh(deckBlockGeom, deckBlockMat);
    deckBlock.position.set(0, 0.07, 0);
    deckBlock.castShadow = true;
    deckGroup.add(deckBlock);

    const textureLoader = new THREE.TextureLoader();
    const backTex = textureLoader.load('/cards/back.png');
    backTex.colorSpace = THREE.SRGBColorSpace;

    const topCardGeom = new THREE.PlaneGeometry(0.52, 0.76);
    const topCardMat = new THREE.MeshStandardMaterial({
      map: backTex,
      roughness: 0.4,
    });
    const topCard = new THREE.Mesh(topCardGeom, topCardMat);
    topCard.rotation.x = -Math.PI / 2;
    topCard.position.y = 0.145;
    deckGroup.add(topCard);

    deckGroup.position.set(hostDeckHandPos.x, 0.95, hostDeckHandPos.z);
    scene.add(deckGroup);

    // 7. Create 3D Role Cards for each Player
    const cardGeom = new THREE.BoxGeometry(0.52, 0.78, 0.006);
    const goldEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.75,
      roughness: 0.35,
    });

    const cardMeshes: THREE.Mesh[] = [];
    const trajectories: typeof cardTrajectoriesRef.current = [];

    seats.forEach((seat, idx) => {
      const isPlayer = idx === 0;

      const backMat = new THREE.MeshStandardMaterial({
        map: backTex,
        roughness: 0.45,
        metalness: 0.1,
      });

      // Đối với bản thân người chơi (P1 / idx === 0): tạo roleMat mang texture vai trò thật.
      // Đối với các người chơi khác (P2 -> P6 / idx > 0): KHÔNG MỞ MẶT NGỬA CHO NGƯỜI KHÁC THẤY,
      // dùng backMat để giữ kín tuyệt đối vai trò bí mật.
      let roleMat: THREE.Material = backMat;
      if (isPlayer) {
        const roleFileName = seat.roleId.toLowerCase() + '.png';
        const roleTex = textureLoader.load(`/cards/${roleFileName}`);
        roleTex.colorSpace = THREE.SRGBColorSpace;
        roleMat = new THREE.MeshStandardMaterial({
          map: roleTex,
          roughness: 0.45,
          metalness: 0.1,
        });
      }

      // BoxGeometry face materials:
      // [0..3]: Viền vàng (+X, -X, +Y, -Y)
      // [4]: +Z Mặt lưng hoa văn (Back texture) -> nhìn thấy từ trên xuống (+Y) khi úp xuống
      // [5]: -Z Mặt trước vai trò (Role texture) -> áp sát mặt đất (-Y) khi úp xuống
      const materials = [
        goldEdgeMat,
        goldEdgeMat,
        goldEdgeMat,
        goldEdgeMat,
        backMat,    // face 4 (+Z): Mặt lưng
        roleMat,    // face 5 (-Z): Mặt trước vai trò (P1 có ảnh vai trò, P2-P6 là mặt úp)
      ];

      const cardMesh = new THREE.Mesh(cardGeom, materials);
      cardMesh.rotation.order = 'YXZ';
      cardMesh.castShadow = true;
      cardMesh.receiveShadow = true;
      cardMesh.position.copy(hostDeckHandPos);
      cardMesh.visible = false;
      cardMesh.userData = { seatIndex: idx, seat };
      scene.add(cardMesh);

      cardMeshes.push(cardMesh);
      seat.cardMesh = cardMesh;

      // Góc quay úp phẳng hoàn toàn trên sàn XZ:
      // rx = -Math.PI / 2, rz = 0, ry = groundYaw
      // Vector pháp tuyến của mặt lưng chỉ thẳng lên trời Vector3(0, 1, 0)
      const groundYaw = Math.atan2(-seat.position.x, -seat.position.z);
      const dummyGround = new THREE.Object3D();
      dummyGround.rotation.order = 'YXZ';
      dummyGround.rotation.set(-Math.PI / 2, groundYaw, 0);
      const qGround = dummyGround.quaternion.clone();

      // Góc quay khi xem bài Inspecting:
      // P1: Thẻ bài nâng lên và lật mở mặt trước (roleMat) hướng thẳng vào camera cá nhân P1 (POV).
      // P2 -> P6: Thẻ bài nhấc lên nhẹ trước ngực, xoay mặt role áp vào ngực của chính họ,
      // mặt ngoài nhìn vào luôn là mặt úp (backMat).
      const dummyInspect = new THREE.Object3D();
      dummyInspect.position.copy(seat.cardInspectPos);
      if (isPlayer) {
        dummyInspect.lookAt(0.95, 1.38, 3.25);
        dummyInspect.rotateY(Math.PI);
      } else {
        dummyInspect.lookAt(seat.position.x, 1.25, seat.position.z);
        dummyInspect.rotateY(Math.PI);
      }
      const qInspect = dummyInspect.quaternion.clone();

      trajectories.push({
        mesh: cardMesh,
        seatId: seat.id,
        isPlayer,
        startPos: hostDeckHandPos.clone(),
        targetPos: seat.cardTargetPos.clone(),
        inspectPos: seat.cardInspectPos.clone(),
        groundYaw,
        qGround,
        qInspect,
        progress: 0,
        delay: idx * 0.15,
        phase: 'ready',
      });
    });

    cardsMeshesRef.current = cardMeshes;
    cardTrajectoriesRef.current = trajectories;

    // 8. Load GLTF Character Models
    const gltfLoader = new GLTFLoader();

    const normalizeModelScale = (model: THREE.Group, targetHeight = 1.75) => {
      const bbox = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      if (size.y > 0) {
        model.scale.setScalar(targetHeight / size.y);
      }
    };

    // Load Host Elder Model
    gltfLoader.load('/models/Knight.glb', (gltf) => {
      if (isDisposed) return;
      const hostModel = gltf.scene;
      hostModelRef.current = hostModel;
      hostModel.position.copy(hostPosition);
      hostModel.rotation.set(0, 0, 0);
      normalizeModelScale(hostModel, 1.88);

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

      const idleAction =
        actions['idle'] || actions['unarmed_idle'] || actions['2h_melee_idle'];
      if (idleAction) {
        idleAction.play();
      }

      setLoadingProgress((prev) => Math.min(100, prev + 25));
    });

    // Load Seated Player Models
    let loadedSeatsCount = 0;
    seats.forEach((seat) => {
      gltfLoader.load(
        seat.modelUrl,
        (gltf) => {
          if (isDisposed) return;
          const playerModel = gltf.scene.clone(true);
          playerModel.position.copy(seat.position);
          playerModel.lookAt(seat.lookAt.x, seat.position.y, seat.lookAt.z);
          normalizeModelScale(playerModel, 1.7);

          playerModel.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              c.castShadow = true;
              c.receiveShadow = true;
            }
          });
          scene.add(playerModel);

          const mixer = new THREE.AnimationMixer(playerModel);
          playerMixersRef.current.push(mixer);

          let sitClip = gltf.animations.find(
            (c) =>
              c.name.toLowerCase() === 'sit_floor_idle' ||
              c.name.toLowerCase() === 'sit_chair_idle' ||
              c.name.toLowerCase() === 'sit_floor_pose'
          );
          if (!sitClip) {
            sitClip = gltf.animations.find((c) => c.name.toLowerCase().includes('idle'));
          }

          if (sitClip) {
            const act = mixer.clipAction(sitClip);
            act.play();
          }

          loadedSeatsCount++;
          setLoadingProgress((prev) => Math.min(100, prev + 12));
          if (loadedSeatsCount === seats.length) {
            setLoading(false);
            if (autoStartSequence) {
              setTimeout(() => runAutoSequence(), 800);
            }
          }
        },
        undefined,
        (err) => {
          console.warn('Could not load character model for seat:', seat.id, err);
          loadedSeatsCount++;
          if (loadedSeatsCount === seats.length) {
            setLoading(false);
          }
        }
      );
    });

    // 9. Raycasting for Card Click Selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      if (!onCardClick) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(cardMeshes, true);
      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;
        while (hitObj && !hitObj.userData?.seat && hitObj.parent) {
          hitObj = hitObj.parent;
        }
        if (hitObj?.userData?.seat) {
          onCardClick(hitObj.userData.seat);
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // 10. Main Render & Animation Loop
    const clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      if (hostMixerRef.current) hostMixerRef.current.update(delta);
      playerMixersRef.current.forEach((m) => m.update(delta));

      // Smoke particles animation
      const smokePosAttr = smokeGeom.attributes.position;
      for (let i = 0; i < smokeCount; i++) {
        let y = smokePosAttr.getY(i) + delta * 0.45;
        if (y > 3.8) y = 0.2;
        smokePosAttr.setY(i, y);
      }
      smokePosAttr.needsUpdate = true;

      // Dust particles gentle hovering
      const dustPosAttr = dustGeom.attributes.position;
      for (let i = 0; i < dustCount; i++) {
        let y = dustPosAttr.getY(i) + Math.sin(elapsed + i) * 0.003;
        dustPosAttr.setY(i, y);
      }
      dustPosAttr.needsUpdate = true;

      // Camera Smooth Transition
      if (cameraRef.current) {
        cameraRef.current.position.lerp(targetCameraPos.current, delta * 3.2);
        currentLookAt.current.lerp(targetLookAt.current, delta * 3.2);
        if (controlsRef.current && internalCameraMode === 'overview') {
          controlsRef.current.target.lerp(currentLookAt.current, delta * 3.2);
        } else if (internalCameraMode === 'pov') {
          cameraRef.current.lookAt(currentLookAt.current);
        }
      }

      // Card Choreography Interpolation Loop
      cardTrajectoriesRef.current.forEach((traj, idx) => {
        const mesh = traj.mesh;
        const seat = seats[idx];

        if (traj.phase === 'ready') {
          mesh.visible = false;
          mesh.position.copy(hostDeckHandPos);
          mesh.quaternion.copy(traj.qGround);
          return;
        }

        mesh.visible = true;

        if (traj.phase === 'dealing') {
          if (traj.delay > 0) {
            traj.delay -= delta;
            mesh.visible = false;
            return;
          }
          mesh.visible = true;

          traj.progress = Math.min(1, traj.progress + delta * 1.55);
          const t = traj.progress;

          // Parabolic Quadratic Bézier arc
          const p0 = traj.startPos;
          const p2 = traj.targetPos;
          const midX = (p0.x + p2.x) / 2;
          const midZ = (p0.z + p2.z) / 2;
          const p1 = new THREE.Vector3(midX, Math.max(p0.y, p2.y) + 2.1, midZ);

          const oneMinusT = 1 - t;
          const curX = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x;
          const curY = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y;
          const curZ = oneMinusT * oneMinusT * p0.z + 2 * oneMinusT * t * p1.z + t * t * p2.z;
          mesh.position.set(curX, curY, curZ);

          // Lá bài luôn giữ phẳng song song mặt đất với rx = -Math.PI / 2, xoay trục Y
          const spinY = (1 - t) * Math.PI * 4;
          mesh.rotation.order = 'YXZ';
          mesh.rotation.set(-Math.PI / 2, traj.groundYaw + spinY, 0);

          if (t >= 1) {
            mesh.position.copy(traj.targetPos);
            mesh.quaternion.copy(traj.qGround);
          }
        } else if (traj.phase === 'dealt') {
          // Nằm phẳng 100% song song với mặt phẳng sàn cỏ/chiếu XZ ở cao độ targetPos.y = 0.015m
          mesh.position.copy(traj.targetPos);
          mesh.quaternion.copy(traj.qGround);
        } else if (traj.phase === 'inspecting') {
          traj.progress = Math.min(1, traj.progress + delta * 2.2);
          const t = traj.progress;
          const ease = t * t * (3 - 2 * t);

          const curPos = new THREE.Vector3().lerpVectors(traj.targetPos, traj.inspectPos, ease);
          if (traj.isPlayer) {
            curPos.y += Math.sin(elapsed * 2.5) * 0.008;
          } else {
            curPos.y += Math.sin(elapsed * 2.2 + idx) * 0.006;
          }
          mesh.position.copy(curPos);

          // P1: Thẻ bài lật mở mặt trước (roleMat) hướng thẳng vào camera cá nhân P1 (POV).
          // P2 -> P6: Thẻ bài nâng lên một chút nhưng mặt role úp vào ngực của chính họ,
          // mặt ngoài nhìn vào là mặt úp (backMat), tuyệt đối không lộ vai trò.
          mesh.quaternion.slerpQuaternions(traj.qGround, traj.qInspect, ease);
        } else if (traj.phase === 'facedown') {
          traj.progress = Math.min(1, traj.progress + delta * 2.2);
          const t = traj.progress;
          const ease = t * t * (3 - 2 * t);

          const curPos = new THREE.Vector3().lerpVectors(traj.inspectPos, traj.targetPos, ease);
          mesh.position.copy(curPos);

          mesh.quaternion.slerpQuaternions(traj.qInspect, traj.qGround, ease);

          if (t >= 1) {
            mesh.position.copy(traj.targetPos);
            mesh.quaternion.copy(traj.qGround);
          }
        }
      });

      if (controlsRef.current && internalCameraMode === 'overview') {
        controlsRef.current.update();
      }

      renderer.render(scene, camera);
    };

    animate();

    // 11. Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ========================================================
    // CLEANUP MEMORY ON UNMOUNT
    // ========================================================
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
      playerMixersRef.current = [];

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
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
    hostPosition,
    hostDeckHandPos,
    seats,
    autoStartSequence,
    runAutoSequence,
    internalCameraMode,
    onCardClick,
  ]);

  const p1Seat = seats[0];
  const p1RoleDef = ROLES_DATABASE[p1Seat.roleId];

  return (
    <div
      className={`relative w-full h-full min-h-[500px] overflow-hidden bg-slate-950 font-sans select-none ${
        isFullscreen ? 'fixed inset-0 z-50' : ''
      } ${className}`}
    >
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white transition-opacity duration-300">
          <div className="relative mb-5">
            <div className="w-16 h-16 rounded-full border-4 border-amber-500/30 border-t-amber-400 animate-spin" />
            <Sun className="w-8 h-8 text-amber-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <h3 className="text-xl font-bold tracking-wide text-amber-200">Đang Dựng Ngôi Làng Ban Ngày...</h3>
          <p className="text-sm text-slate-300 mt-2 max-w-sm text-center">
            Tải mô hình cư dân, chuẩn bị cỗ bài ma thuật và ánh sáng bình minh.
          </p>
          <div className="w-64 h-2 bg-slate-800 rounded-full mt-4 overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300 rounded-full"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Top Header Bar (Shown when overlay controls enabled or standalone) */}
      {(showInternalControls !== undefined ? showInternalControls : showOverlayControls) && (
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          {/* Title & Phase Badge */}
          <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700/60 shadow-xl">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sun className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">Làng Ban Ngày 3D</h2>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {internalPhase.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{statusMessage}</p>
            </div>
          </div>

          {/* Top Right Actions */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => switchCameraMode(internalCameraMode === 'overview' ? 'pov' : 'overview')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold backdrop-blur-md transition-all shadow-lg border ${
                internalCameraMode === 'pov'
                  ? 'bg-amber-600/90 text-white border-amber-400 shadow-amber-500/20'
                  : 'bg-slate-900/80 text-slate-200 border-slate-700 hover:bg-slate-800'
              }`}
              title="Đổi góc nhìn Camera"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">
                {internalCameraMode === 'pov' ? 'Góc Nhìn P1 (POV)' : 'Toàn Cảnh (Overview)'}
              </span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-slate-900/80 backdrop-blur-md text-slate-300 border border-slate-700 hover:text-white transition shadow-lg"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-900/80 backdrop-blur-md text-slate-300 border border-slate-700 hover:text-rose-400 hover:border-rose-500/40 transition shadow-lg"
                title="Đóng 3D Viewer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Role Inspection Card Overlay (Visible when Inspecting in POV Mode) */}
      {(internalPhase === 'inspecting' || currentStep === 'PEEKING') && p1RoleDef && (
        <div className="absolute top-20 right-4 z-20 w-72 bg-slate-900/90 backdrop-blur-xl border border-amber-500/40 rounded-2xl p-4 shadow-2xl text-white animate-fade-in pointer-events-auto">
          <div className="flex items-center gap-3 mb-2">
            <img
              src={`/cards/${p1Seat.roleId.toLowerCase()}.png`}
              alt={p1Seat.roleName}
              className="w-12 h-16 object-cover rounded-lg border border-amber-400/50 shadow-md"
            />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                {p1Seat.team}
              </span>
              <h4 className="text-base font-extrabold text-white">{p1Seat.roleName}</h4>
              <p className="text-[11px] text-slate-300">Thẻ bài của bạn</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 border-t border-slate-800 pt-2 line-clamp-3">
            {p1RoleDef.shortAbility || p1RoleDef.description}
          </p>
        </div>
      )}

      {/* Bottom Floating Interactive Choreography Control Bar */}
      {(showInternalControls !== undefined ? showInternalControls : showOverlayControls) && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-2 px-4 py-3 bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-700/80 shadow-2xl max-w-full">
          <button
            onClick={dealCards}
            disabled={loading || internalPhase === 'dealing'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              internalPhase === 'dealing'
                ? 'bg-amber-600/50 text-amber-200 cursor-not-allowed border border-amber-500/30'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold shadow-amber-500/30'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Chia Bài</span>
          </button>

          <button
            onClick={pickAndInspectCards}
            disabled={loading || internalPhase === 'ready' || internalPhase === 'dealing'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              internalPhase === 'inspecting'
                ? 'bg-emerald-600 text-white border border-emerald-400'
                : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Xem Thẻ Bài</span>
          </button>

          <button
            onClick={placeCardsFaceDown}
            disabled={loading || internalPhase === 'ready' || internalPhase === 'dealing'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              internalPhase === 'facedown'
                ? 'bg-blue-600 text-white border border-blue-400'
                : 'bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <EyeOff className="w-4 h-4" />
            <span>Úp Thẻ Bài</span>
          </button>

          <button
            onClick={resetCards}
            disabled={loading || internalPhase === 'dealing'}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-95 disabled:opacity-40"
            title="Thu hồi bài về Quản trò"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <div className="h-6 w-[1px] bg-slate-700/80 mx-1 hidden sm:block" />

          <button
            onClick={runAutoSequence}
            disabled={loading || isAutoPlaying}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-500 text-white border border-indigo-400/40 transition shadow-indigo-500/20 active:scale-95 disabled:opacity-40"
            title="Trình diễn kịch bản hoàn chỉnh từ A đến Z"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Tự Động Kịch Bản</span>
          </button>
        </div>
      )}

      {/* Bottom Left Quick Tip */}
      <div className="absolute bottom-5 left-4 z-10 hidden md:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80 pointer-events-none">
        <Info className="w-3.5 h-3.5 text-amber-400" />
        <span>Kéo chuột để xoay 360°, cuộn chuột để zoom làng</span>
      </div>
    </div>
  );
});

DayPhase3DViewer.displayName = 'DayPhase3DViewer';

export default DayPhase3DViewer;
