import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Move,
  Flame,
  Moon,
  Eye,
  RotateCcw,
  Sparkles,
  Zap,
  X,
  Info,
  Maximize2,
  Minimize2,
  Footprints,
  Compass,
  Check,
  AlertTriangle,
  UserCheck,
  Users
} from 'lucide-react';

export interface ModelOption {
  id: string;
  name: string;
  url: string;
  role?: string;
  description?: string;
}

export const DEFAULT_MODELS: ModelOption[] = [
  {
    id: 'knight',
    name: 'Hiệp Sĩ',
    url: '/models/Knight.glb',
    role: 'Bảo Vệ',
    description: 'Chiến binh hộ vệ áo giáp kiên cố, sẵn sàng hy sinh bảo vệ dân làng.'
  },
  {
    id: 'mage',
    name: 'Phù Thủy',
    url: '/models/Mage.glb',
    role: 'Phù Thủy / Tiên Tri',
    description: 'Bậc thầy bùa chú thần bí với bình thuốc cứu sinh và độc dược hủy diệt.'
  },
  {
    id: 'rogue',
    name: 'Sát Thủ',
    url: '/models/Rogue.glb',
    role: 'Ma Sói / Sát Nhân',
    description: 'Kẻ ẩn mình trong bóng đêm với tốc độ xé gió và bước chân rón rén.'
  },
  {
    id: 'soldier',
    name: 'Chiến Binh',
    url: '/models/Soldier.glb',
    role: 'Quân Nhân Làng',
    description: 'Lực lượng vũ trang tinh nhuệ, trang nghiêm tuần tra bảo vệ an ninh.'
  },
  {
    id: 'xbot',
    name: 'Dân Làng X',
    url: '/models/Xbot.glb',
    role: 'Dân Làng',
    description: 'Mô hình chuẩn rigged đầy đủ bộ chuyển động di chuyển & biểu cảm.'
  },
  {
    id: 'ybot',
    name: 'Thợ Săn Y',
    url: '/models/Ybot.glb',
    role: 'Thợ Săn',
    description: 'Mô hình thám tử / thợ săn nhanh nhẹn, điều tra trong đêm tối.'
  }
];

export interface Character3DViewerProps {
  modelUrl?: string;
  availableModels?: ModelOption[];
  onModelChange?: (model: ModelOption) => void;
  onClose?: () => void;
  className?: string;
  title?: string;
  showControls?: boolean;
}

export const Character3DViewer: React.FC<Character3DViewerProps> = ({
  modelUrl = '/models/Knight.glb',
  availableModels = DEFAULT_MODELS,
  onModelChange,
  onClose,
  className = '',
  title = 'Khu Vực Thử Nghiệm Nhân Vật 3D - Đêm Ma Sói',
  showControls = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // UI States
  const [selectedModelUrl, setSelectedModelUrl] = useState<string>(modelUrl);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [currentAnim, setCurrentAnim] = useState<string>('idle');
  const [availableAnims, setAvailableAnims] = useState<string[]>([]);
  const [isSprint, setIsSprint] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'follow' | 'orbit'>('follow');
  const [showHelp, setShowHelp] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Sync prop modelUrl to local state
  useEffect(() => {
    if (modelUrl && modelUrl !== selectedModelUrl) {
      setSelectedModelUrl(modelUrl);
    }
  }, [modelUrl]);

  // Joystick touch state
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState<boolean>(false);

  // Three.js and animation references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const characterRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const fireLightRef = useRef<THREE.PointLight | null>(null);
  const embersPointsRef = useRef<THREE.Points | null>(null);
  const willOWispsRef = useRef<THREE.Points | null>(null);

  // Input controller references
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const joystickVector = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSprintRef = useRef<boolean>(false);
  const isEmotePlayingRef = useRef<boolean>(false);
  const cameraModeRef = useRef<'follow' | 'orbit'>('follow');
  const isUserInteractingControlsRef = useRef<boolean>(false);

  // Keep ref sync with state
  useEffect(() => {
    isSprintRef.current = isSprint;
  }, [isSprint]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    if (controlsRef.current) {
      if (cameraMode === 'follow') {
        controlsRef.current.enablePan = false;
        controlsRef.current.maxPolarAngle = Math.PI / 2 - 0.05;
        controlsRef.current.minDistance = 2.5;
        controlsRef.current.maxDistance = 12.0;
      } else {
        controlsRef.current.enablePan = true;
        controlsRef.current.maxPolarAngle = Math.PI / 2 + 0.1;
        controlsRef.current.minDistance = 1.5;
        controlsRef.current.maxDistance = 30.0;
      }
    }
  }, [cameraMode]);

  // ============================================================
  // ANIMATION CROSSFADE HELPER
  // ============================================================
  const fadeToAction = useCallback((animName: string, duration = 0.25, loopOnce = false) => {
    const targetAction = actionsRef.current[animName.toLowerCase()];
    if (!targetAction) return;

    if (activeActionRef.current === targetAction) {
      return;
    }

    if (loopOnce) {
      isEmotePlayingRef.current = true;
      targetAction.reset();
      targetAction.setLoop(THREE.LoopOnce, 1);
      targetAction.clampWhenFinished = true;
    } else {
      isEmotePlayingRef.current = false;
      targetAction.reset();
      targetAction.setLoop(THREE.LoopRepeat, Infinity);
    }

    targetAction.fadeIn(duration).play();

    if (activeActionRef.current) {
      activeActionRef.current.fadeOut(duration);
    }

    activeActionRef.current = targetAction;
    setCurrentAnim(animName);
  }, []);

  // Trigger emote actions
  const triggerEmote = useCallback((emoteName: string) => {
    const lower = emoteName.toLowerCase();
    if (actionsRef.current[lower]) {
      fadeToAction(lower, 0.2, true);
    }
  }, [fadeToAction]);

  // Reset character to campfire circle position
  const resetCharacterPosition = useCallback(() => {
    if (characterRef.current) {
      characterRef.current.position.set(0, 0, 4.5);
      characterRef.current.rotation.set(0, Math.PI, 0);
      fadeToAction('idle', 0.2);
    }
  }, [fadeToAction]);

  // ============================================================
  // LOAD & MAP CHARACTER MODEL HELPER
  // ============================================================
  const loadCharacterModel = useCallback((url: string) => {
    const scene = sceneRef.current;
    if (!scene) return;

    setLoading(true);
    setLoadingError(null);
    setLoadingProgress(15);

    // 1. Remove previous character if exists
    if (characterRef.current) {
      scene.remove(characterRef.current);
      characterRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });
      characterRef.current = null;
    }

    // Stop mixer
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
    }
    actionsRef.current = {};
    activeActionRef.current = null;
    isEmotePlayingRef.current = false;

    // 2. Load new GLTF
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        characterRef.current = model;

        // Position character near campfire facing forward
        model.position.set(0, 0, 4.5);
        model.rotation.set(0, Math.PI, 0);

        // Normalize character bounding box height to standard ~1.8m
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        if (size.y > 0) {
          const targetHeight = 1.8;
          const scaleFactor = targetHeight / size.y;
          model.scale.setScalar(scaleFactor);
        }

        // Enable shadows on all character meshes
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);

        // 3. Setup Animation Mixer & Mapping
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        const actionsMap: Record<string, THREE.AnimationAction> = {};
        const animNamesList: string[] = [];

        // Register all raw clips in dictionary
        gltf.animations.forEach((clip) => {
          const action = mixer.clipAction(clip);
          actionsMap[clip.name.toLowerCase()] = action;
          actionsMap[clip.name] = action;
          animNamesList.push(clip.name);
        });

        // Smart finder helper for canonical animation aliases
        const findFirstClip = (patterns: string[]) => {
          for (const pat of patterns) {
            const match = gltf.animations.find((c) => c.name.toLowerCase() === pat.toLowerCase());
            if (match) return actionsMap[match.name.toLowerCase()];
          }
          for (const pat of patterns) {
            const match = gltf.animations.find((c) => c.name.toLowerCase().includes(pat.toLowerCase()));
            if (match) return actionsMap[match.name.toLowerCase()];
          }
          return null;
        };

        // Canonical IDLE: 'idle' | 'unarmed_idle' | '2h_melee_idle'
        const idleAction = findFirstClip(['idle', 'unarmed_idle', '2h_melee_idle', 'lie_idle']);
        if (idleAction) actionsMap['idle'] = idleAction;

        // Canonical WALK: 'walk' | 'walking_a' | 'walking_b' | 'walking_c'
        const walkAction = findFirstClip(['walk', 'walking_a', 'walking_b', 'walking_c', 'walking']);
        if (walkAction) actionsMap['walk'] = walkAction;

        // Canonical RUN: 'run' | 'running_a' | 'running_b'
        const runAction = findFirstClip(['run', 'running_a', 'running_b', 'running']);
        if (runAction) actionsMap['run'] = runAction;

        // Canonical EMOTE: Agree / Cheer / Wave
        const agreeAction = findFirstClip(['agree', 'cheer', 'interact', 'wave', 'use_item', 'cheering']);
        if (agreeAction) actionsMap['agree'] = agreeAction;

        // Canonical EMOTE: HeadShake / Block / Hit
        const headShakeAction = findFirstClip(['headshake', 'block', 'hit_a', 'hit_b', 'block_attack']);
        if (headShakeAction) actionsMap['headshake'] = headShakeAction;

        // Canonical EMOTE: Sneak / Dodge / Crouch
        const sneakAction = findFirstClip(['sneak_pose', 'dodge_backward', 'dodge_forward', 'sit_floor_pose']);
        if (sneakAction) actionsMap['sneak_pose'] = sneakAction;

        actionsRef.current = actionsMap;
        setAvailableAnims(animNamesList);

        // Listen for loop/completion of one-shot emotes
        mixer.addEventListener('finished', () => {
          isEmotePlayingRef.current = false;
          // Fade back to idle smoothly
          fadeToAction('idle', 0.25);
        });

        // Start with idle animation
        if (actionsMap['idle']) {
          const idleAct = actionsMap['idle'];
          idleAct.play();
          activeActionRef.current = idleAct;
          setCurrentAnim('idle');
        } else if (gltf.animations.length > 0) {
          const firstAct = mixer.clipAction(gltf.animations[0]);
          firstAct.play();
          activeActionRef.current = firstAct;
          setCurrentAnim(gltf.animations[0].name);
        }

        setLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          setLoadingProgress(pct);
        }
      },
      (error) => {
        console.error('Error loading 3D character:', error);
        setLoading(false);
        setLoadingError('Không thể tải mô hình 3D. Vui lòng kiểm tra lại đường dẫn model.');
      }
    );
  }, [fadeToAction]);

  // ============================================================
  // INITIALIZE THREE.JS SCENE (Runs Once)
  // ============================================================
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x070b14);
    // Atmospheric spooky night fog
    scene.fog = new THREE.FogExp2(0x070d18, 0.035);

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0, 4, 9);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls (third person helper / free orbit)
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.2, 4.5);
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera sinking under ground
    controls.minDistance = 2.5;
    controls.maxDistance = 15;
    controls.addEventListener('start', () => {
      isUserInteractingControlsRef.current = true;
    });
    controls.addEventListener('end', () => {
      isUserInteractingControlsRef.current = false;
    });

    // 5. Atmospheric Lighting
    // Moonlit ambient light
    const ambientLight = new THREE.AmbientLight(0x1a263c, 0.85);
    scene.add(ambientLight);

    // Moon directional light with soft shadows
    const moonLight = new THREE.DirectionalLight(0x7da4d9, 1.35);
    moonLight.position.set(-14, 22, -12);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 50;
    const shadowD = 16;
    moonLight.shadow.camera.left = -shadowD;
    moonLight.shadow.camera.right = shadowD;
    moonLight.shadow.camera.top = shadowD;
    moonLight.shadow.camera.bottom = -shadowD;
    moonLight.shadow.bias = -0.0005;
    scene.add(moonLight);

    // Moonlight helper visual disc
    const moonGeo = new THREE.SphereGeometry(1.6, 24, 24);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xebf4ff });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(-30, 48, -26);
    scene.add(moonMesh);

    // Campfire central PointLight (flickering orange flame)
    const fireLight = new THREE.PointLight(0xff6a00, 5.0, 18, 2.0);
    fireLight.position.set(0, 1.1, 0);
    fireLight.castShadow = true;
    fireLight.shadow.mapSize.width = 1024;
    fireLight.shadow.mapSize.height = 1024;
    fireLight.shadow.bias = -0.001;
    scene.add(fireLight);
    fireLightRef.current = fireLight;

    // Secondary warm ambient glow near the fire pit
    const fireGlowLight = new THREE.PointLight(0xff3700, 2.5, 6, 2.0);
    fireGlowLight.position.set(0, 0.3, 0);
    scene.add(fireGlowLight);

    // ============================================================
    // ENVIRONMENT: CIRCULAR RITUAL GROUND & CAMPFIRE
    // ============================================================
    // Main circular village ground
    const groundGeo = new THREE.CylinderGeometry(15, 15, 0.6, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      roughness: 0.9,
      metalness: 0.05
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, -0.3, 0);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Inner circular stone path rings
    const stoneRingGeo = new THREE.RingGeometry(3.2, 3.8, 48);
    const stoneRingMat = new THREE.MeshStandardMaterial({
      color: 0x222b3d,
      roughness: 0.8,
      side: THREE.DoubleSide
    });
    const stoneRing = new THREE.Mesh(stoneRingGeo, stoneRingMat);
    stoneRing.rotation.x = -Math.PI / 2;
    stoneRing.position.set(0, 0.01, 0);
    stoneRing.receiveShadow = true;
    scene.add(stoneRing);

    // Perimeter stone border blocks
    const perimeterCount = 36;
    const stoneBorderGroup = new THREE.Group();
    for (let i = 0; i < perimeterCount; i++) {
      const angle = (i / perimeterCount) * Math.PI * 2;
      const r = 14.6 + (Math.sin(i * 3) * 0.2);
      const stoneW = 0.9 + (i % 3) * 0.2;
      const stoneH = 0.35 + (i % 2) * 0.15;
      const stoneD = 0.7 + (i % 4) * 0.1;
      const stoneBGeo = new THREE.BoxGeometry(stoneW, stoneH, stoneD);
      const stoneBMat = new THREE.MeshStandardMaterial({
        color: 0x192131,
        roughness: 0.85
      });
      const stoneB = new THREE.Mesh(stoneBGeo, stoneBMat);
      stoneB.position.set(Math.cos(angle) * r, stoneH / 2, Math.sin(angle) * r);
      stoneB.rotation.y = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.2;
      stoneB.castShadow = true;
      stoneB.receiveShadow = true;
      stoneBorderGroup.add(stoneB);
    }
    scene.add(stoneBorderGroup);

    // Stylized Dark Pine Trees around perimeter for gothic atmosphere
    const treeGroup = new THREE.Group();
    const treePositions = [
      { angle: 0.2, dist: 16.5, scale: 1.1 },
      { angle: 0.7, dist: 17.2, scale: 0.9 },
      { angle: 1.3, dist: 16.8, scale: 1.3 },
      { angle: 1.9, dist: 17.5, scale: 1.0 },
      { angle: 2.6, dist: 16.2, scale: 1.2 },
      { angle: 3.2, dist: 17.0, scale: 0.95 },
      { angle: 3.8, dist: 16.4, scale: 1.15 },
      { angle: 4.4, dist: 17.3, scale: 1.25 },
      { angle: 5.1, dist: 16.7, scale: 0.9 },
      { angle: 5.8, dist: 17.1, scale: 1.05 }
    ];

    treePositions.forEach((tp) => {
      const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x140e0b, roughness: 0.95 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.1;
      trunk.castShadow = true;

      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x09141f, roughness: 0.85 });
      const f1 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 7), foliageMat);
      f1.position.y = 2.4;
      f1.castShadow = true;

      const f2 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.8, 7), foliageMat);
      f2.position.y = 3.6;
      f2.castShadow = true;

      const f3 = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.4, 7), foliageMat);
      f3.position.y = 4.6;
      f3.castShadow = true;

      const tree = new THREE.Group();
      tree.add(trunk, f1, f2, f3);
      tree.position.set(Math.cos(tp.angle) * tp.dist, 0, Math.sin(tp.angle) * tp.dist);
      tree.scale.setScalar(tp.scale);
      treeGroup.add(tree);
    });
    scene.add(treeGroup);

    // Ancient Rune Stones / Totems at 4 corners
    const totemGroup = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + 0.4;
      const r = 13.0;
      const obeliskGeo = new THREE.BoxGeometry(0.7, 2.4, 0.5);
      const obeliskMat = new THREE.MeshStandardMaterial({ color: 0x1c2538, roughness: 0.8 });
      const obelisk = new THREE.Mesh(obeliskGeo, obeliskMat);
      obelisk.position.set(Math.cos(angle) * r, 1.2, Math.sin(angle) * r);
      obelisk.rotation.y = angle;
      obelisk.castShadow = true;
      obelisk.receiveShadow = true;

      // Glowing rune gem on totem
      const gemGeo = new THREE.OctahedronGeometry(0.18);
      const gemMat = new THREE.MeshBasicMaterial({ color: 0x4dd0e1 });
      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.position.set(Math.cos(angle) * r, 1.8, Math.sin(angle) * r);
      totemGroup.add(obelisk, gem);
    }
    scene.add(totemGroup);

    // ============================================================
    // CAMPFIRE MODEL IN THE CENTER
    // ============================================================
    const campfireGroup = new THREE.Group();

    // Fire pit rock circle
    const rockCount = 12;
    for (let i = 0; i < rockCount; i++) {
      const angle = (i / rockCount) * Math.PI * 2;
      const rockR = 1.05 + (Math.sin(i * 2) * 0.08);
      const rockGeo = new THREE.DodecahedronGeometry(0.24, 0);
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x272c38, roughness: 0.9 });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(Math.cos(angle) * rockR, 0.12, Math.sin(angle) * rockR);
      rock.scale.set(1 + Math.random() * 0.3, 0.8, 1 + Math.random() * 0.3);
      rock.castShadow = true;
      campfireGroup.add(rock);
    }

    // Burnt charcoal bed at center
    const ashGeo = new THREE.CircleGeometry(0.95, 24);
    const ashMat = new THREE.MeshStandardMaterial({
      color: 0x0f0c0b,
      roughness: 0.95,
      emissive: 0x331000,
      emissiveIntensity: 0.6
    });
    const ashMesh = new THREE.Mesh(ashGeo, ashMat);
    ashMesh.rotation.x = -Math.PI / 2;
    ashMesh.position.y = 0.02;
    campfireGroup.add(ashMesh);

    // Firewood logs teepee
    const logGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.3, 8);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x22130c, roughness: 0.95 });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.set(Math.cos(angle) * 0.45, 0.4, Math.sin(angle) * 0.45);
      log.rotation.x = 0.55;
      log.rotation.y = angle;
      log.castShadow = true;
      campfireGroup.add(log);
    }

    // Stylized Glowing Flame Mesh
    const flameGeo = new THREE.ConeGeometry(0.55, 1.4, 12);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff6200,
      transparent: true,
      opacity: 0.85
    });
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.position.set(0, 0.75, 0);
    campfireGroup.add(flameMesh);

    const innerFlameGeo = new THREE.ConeGeometry(0.3, 1.0, 12);
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0.9
    });
    const innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    innerFlame.position.set(0, 0.6, 0);
    campfireGroup.add(innerFlame);

    scene.add(campfireGroup);

    // Rising Campfire Embers (Sparks)
    const embersCount = 120;
    const embersGeo = new THREE.BufferGeometry();
    const embersPos = new Float32Array(embersCount * 3);
    const embersSpeed = new Float32Array(embersCount);

    for (let i = 0; i < embersCount; i++) {
      const i3 = i * 3;
      const r = Math.random() * 0.7;
      const angle = Math.random() * Math.PI * 2;
      embersPos[i3] = Math.cos(angle) * r;
      embersPos[i3 + 1] = 0.3 + Math.random() * 3.5;
      embersPos[i3 + 2] = Math.sin(angle) * r;
      embersSpeed[i] = 0.8 + Math.random() * 1.5;
    }

    embersGeo.setAttribute('position', new THREE.BufferAttribute(embersPos, 3));
    const embersMat = new THREE.PointsMaterial({
      color: 0xff9900,
      size: 0.12,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const embersPoints = new THREE.Points(embersGeo, embersMat);
    scene.add(embersPoints);
    embersPointsRef.current = embersPoints;

    // Drifting Will-O'-Wisps / Spooky Night Orbs
    const wispCount = 40;
    const wispGeo = new THREE.BufferGeometry();
    const wispPos = new Float32Array(wispCount * 3);
    for (let i = 0; i < wispCount; i++) {
      const i3 = i * 3;
      const r = 4 + Math.random() * 9.5;
      const angle = Math.random() * Math.PI * 2;
      wispPos[i3] = Math.cos(angle) * r;
      wispPos[i3 + 1] = 0.6 + Math.random() * 2.8;
      wispPos[i3 + 2] = Math.sin(angle) * r;
    }
    wispGeo.setAttribute('position', new THREE.BufferAttribute(wispPos, 3));
    const wispMat = new THREE.PointsMaterial({
      color: 0x4df0b0,
      size: 0.18,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    const willOWisps = new THREE.Points(wispGeo, wispMat);
    scene.add(willOWisps);
    willOWispsRef.current = willOWisps;

    // Initial character load
    loadCharacterModel(selectedModelUrl);

    // ============================================================
    // ANIMATION & RENDER LOOP
    // ============================================================
    const clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // 1. Flicker campfire light
      if (fireLightRef.current) {
        const flicker =
          Math.sin(elapsedTime * 14) * 0.6 +
          Math.cos(elapsedTime * 23) * 0.4 +
          (Math.random() - 0.5) * 0.35;
        fireLightRef.current.intensity = 4.8 + flicker;
        fireLightRef.current.position.x = Math.sin(elapsedTime * 8) * 0.05;
        fireLightRef.current.position.z = Math.cos(elapsedTime * 7) * 0.05;
      }

      // Animate flame meshes
      if (flameMesh) {
        flameMesh.scale.y = 1 + Math.sin(elapsedTime * 15) * 0.08;
        flameMesh.scale.x = 1 + Math.cos(elapsedTime * 11) * 0.06;
      }

      // 2. Animate campfire sparks/embers
      if (embersPointsRef.current) {
        const positions = embersPointsRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < embersCount; i++) {
          const i3 = i * 3;
          positions[i3 + 1] += embersSpeed[i] * delta;
          positions[i3] += Math.sin(elapsedTime * 3 + i) * 0.006;
          positions[i3 + 2] += Math.cos(elapsedTime * 3 + i) * 0.006;

          // Reset when risen above fire
          if (positions[i3 + 1] > 4.5) {
            positions[i3 + 1] = 0.3;
            const r = Math.random() * 0.6;
            const angle = Math.random() * Math.PI * 2;
            positions[i3] = Math.cos(angle) * r;
            positions[i3 + 2] = Math.sin(angle) * r;
          }
        }
        embersPointsRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // 3. Animate drifting will-o'-wisps
      if (willOWispsRef.current) {
        const positions = willOWispsRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < wispCount; i++) {
          const i3 = i * 3;
          positions[i3 + 1] += Math.sin(elapsedTime * 1.5 + i) * 0.003;
          // slow orbital drift
          const currentX = positions[i3];
          const currentZ = positions[i3 + 2];
          const angle = Math.atan2(currentZ, currentX) + 0.12 * delta;
          const dist = Math.sqrt(currentX * currentX + currentZ * currentZ);
          positions[i3] = Math.cos(angle) * dist;
          positions[i3 + 2] = Math.sin(angle) * dist;
        }
        willOWispsRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // 4. Update Animation Mixer
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // 5. Character Movement Controller Logic
      const character = characterRef.current;
      if (character) {
        // Collect keyboard input
        let inputX = 0;
        let inputY = 0;

        if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) inputY += 1;
        if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) inputY -= 1;
        if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) inputX -= 1;
        if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) inputX += 1;

        // Add joystick input
        if (joystickVector.current.x !== 0 || joystickVector.current.y !== 0) {
          inputX += joystickVector.current.x;
          inputY += joystickVector.current.y;
        }

        const inputLength = Math.sqrt(inputX * inputX + inputY * inputY);
        const isMoving = inputLength > 0.08;

        if (isMoving && !isEmotePlayingRef.current) {
          // Normalize input
          const normX = inputX / (inputLength > 1 ? inputLength : 1);
          const normY = inputY / (inputLength > 1 ? inputLength : 1);

          // Calculate move direction relative to camera facing angle
          const cam = cameraRef.current;
          const forward = new THREE.Vector3(0, 0, -1);
          const right = new THREE.Vector3(1, 0, 0);

          if (cam) {
            forward.setFromMatrixColumn(cam.matrix, 2).negate();
            forward.y = 0;
            forward.normalize();

            right.setFromMatrixColumn(cam.matrix, 0);
            right.y = 0;
            right.normalize();
          }

          const moveDir = new THREE.Vector3()
            .addScaledVector(forward, normY)
            .addScaledVector(right, normX)
            .normalize();

          // Calculate speed and animation
          const sprintActive = isSprintRef.current || keysPressed.current['ShiftLeft'] || keysPressed.current['ShiftRight'];
          const speed = sprintActive ? 5.6 : 2.4;
          const targetAnim = sprintActive ? 'run' : 'walk';

          // Rotate character smoothly toward move direction
          const targetRotationY = Math.atan2(moveDir.x, moveDir.z);
          let angleDiff = targetRotationY - character.rotation.y;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          character.rotation.y += angleDiff * Math.min(1, delta * 12);

          // Update position with collision boundary limits
          const nextPos = character.position.clone().addScaledVector(moveDir, speed * delta);
          const distFromCenter = Math.sqrt(nextPos.x * nextPos.x + nextPos.z * nextPos.z);

          // Avoid stepping straight into the burning campfire (inner radius: 1.3m)
          // Keep inside village perimeter (outer radius: 13.5m)
          if (distFromCenter < 1.3) {
            // Push away from campfire center
            const pushDir = new THREE.Vector2(nextPos.x, nextPos.z).normalize();
            nextPos.x = pushDir.x * 1.3;
            nextPos.z = pushDir.y * 1.3;
          } else if (distFromCenter > 13.5) {
            // Clamp to arena boundary
            const clampDir = new THREE.Vector2(nextPos.x, nextPos.z).normalize();
            nextPos.x = clampDir.x * 13.5;
            nextPos.z = clampDir.y * 13.5;
          }

          character.position.copy(nextPos);

          // Crossfade to walk/run
          fadeToAction(targetAnim, 0.2);
        } else if (!isEmotePlayingRef.current) {
          // No movement: crossfade to idle
          fadeToAction('idle', 0.25);
        }

        // 6. Camera Follow Behavior
        if (cameraModeRef.current === 'follow' && controlsRef.current && cameraRef.current) {
          const charPos = character.position;
          // Target character torso/head
          const targetLookAt = new THREE.Vector3(charPos.x, charPos.y + 1.25, charPos.z);
          controlsRef.current.target.lerp(targetLookAt, 0.1);

          // Smoothly maintain camera offset behind character
          // Only auto-lerp position if user isn't actively dragging orbit controls
          if (!isUserInteractingControlsRef.current) {
            const camOffset = new THREE.Vector3(0, 2.8, 5.2);
            // Apply slight rotation around character based on controls azimuth
            camOffset.applyEuler(new THREE.Euler(0, character.rotation.y + Math.PI, 0));
            const desiredCamPos = charPos.clone().add(camOffset);
            desiredCamPos.y = Math.max(0.8, desiredCamPos.y); // Keep above ground
            cameraRef.current.position.lerp(desiredCamPos, 0.05);
          }
        }
      }

      // Update controls
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Render frame
      renderer.render(scene, camera);
    };

    animate();

    // ============================================================
    // KEYBOARD EVENT LISTENERS
    // ============================================================
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }

      keysPressed.current[e.code] = true;

      // Quick hotkeys for emotes
      if (e.code === 'Digit1') triggerEmote('agree');
      if (e.code === 'Digit2') triggerEmote('headShake');
      if (e.code === 'Digit3') triggerEmote('sneak_pose');
      if (e.code === 'KeyR') resetCharacterPosition();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // ============================================================
    // RESIZE LISTENER
    // ============================================================
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // ============================================================
    // CLEANUP DISPOSE ON UNMOUNT
    // ============================================================
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }

      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      resizeObserver.disconnect();

      // Dispose scene meshes, geometries, materials
      scene.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        if (rendererRef.current.domElement && container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, []); // Run scene setup once

  // Reload character when selectedModelUrl changes (smooth character swap)
  useEffect(() => {
    if (sceneRef.current) {
      loadCharacterModel(selectedModelUrl);
    }
  }, [selectedModelUrl, loadCharacterModel]);

  // ============================================================
  // JOYSTICK TOUCH CONTROLLER HANDLERS
  // ============================================================
  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsJoystickActive(true);
    handleJoystickMove(e);
  };

  const handleJoystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isJoystickActive && e.buttons !== 1) return;
    const container = joystickContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rawX = e.clientX - centerX;
    const rawY = e.clientY - centerY;

    const maxRadius = rect.width / 2 - 16;
    const dist = Math.sqrt(rawX * rawX + rawY * rawY);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(rawY, rawX);

    const clampedX = Math.cos(angle) * clampedDist;
    const clampedY = Math.sin(angle) * clampedDist;

    setJoystickPos({ x: clampedX, y: clampedY });

    // Normalized input vector: -1 to 1 (y inverted for standard 3D forward)
    const normX = clampedDist > 0 ? (clampedX / maxRadius) : 0;
    const normY = clampedDist > 0 ? -(clampedY / maxRadius) : 0;

    joystickVector.current = { x: normX, y: normY };
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored if already released
    }
    setIsJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    joystickVector.current = { x: 0, y: 0 };
  };

  const handleModelSelect = (option: ModelOption) => {
    setSelectedModelUrl(option.url);
    if (onModelChange) {
      onModelChange(option);
    }
  };

  const toggleFullscreen = () => {
    if (!mountRef.current?.parentElement) return;
    if (!document.fullscreenElement) {
      mountRef.current.parentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentModelData = availableModels.find((m) => m.url === selectedModelUrl) || availableModels[0];

  return (
    <div className={`relative w-full h-full min-h-[500px] overflow-hidden bg-[#070b14] select-none text-zinc-100 ${className}`}>
      {/* 3D Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Header Control Bar */}
      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/85 via-black/50 to-transparent flex flex-wrap items-center justify-between gap-3 pointer-events-auto z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/40">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span>{title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hidden sm:inline-flex">
                Three.js 3D
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400 flex items-center gap-2">
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>{currentModelData?.name || 'Nhân Vật 3D'}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-amber-300 font-mono text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                {currentAnim.toUpperCase()}
              </span>
            </p>
          </div>
        </div>

        {/* Top Right Quick Actions & Model Selector */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Character Model Selector (Horizontal Pills) */}
          {availableModels.length > 1 && (
            <div className="flex items-center bg-zinc-950/80 border border-zinc-800 rounded-2xl p-1 gap-1 max-w-[320px] sm:max-w-none overflow-x-auto">
              {availableModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModelSelect(m)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                    selectedModelUrl === m.url
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                  title={`${m.name} - ${m.role || ''}`}
                >
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Camera Mode Switch */}
          <button
            onClick={() => setCameraMode(cameraMode === 'follow' ? 'orbit' : 'follow')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition shadow-sm cursor-pointer ${
              cameraMode === 'follow'
                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200 hover:bg-indigo-600/40'
                : 'bg-zinc-900/80 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Đổi chế độ Camera: Theo sau nhân vật / Tự do quan sát"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Camera:</span>
            <span>{cameraMode === 'follow' ? 'Theo Sau' : 'Tự Do'}</span>
          </button>

          {/* Help button */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`p-2 rounded-xl border text-xs transition shadow-sm cursor-pointer ${
              showHelp
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-zinc-900/80 border-zinc-700/60 text-zinc-400 hover:text-white'
            }`}
            title="Hướng dẫn điều khiển"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-700/60 text-zinc-400 hover:text-white transition shadow-sm cursor-pointer"
            title="Toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close button if provided */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 hover:bg-rose-900/60 transition shadow-sm cursor-pointer"
              title="Đóng viewer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-20 pointer-events-auto">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" />
            <div className="w-14 h-14 rounded-full border-3 border-amber-500/30 border-t-amber-400 animate-spin" />
            <Flame className="w-6 h-6 text-amber-400 absolute animate-pulse" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-sm font-bold text-white tracking-wide">Đang nạp mô hình & chuyển động...</h3>
            <p className="text-xs text-zinc-400 font-mono">Đã tải: {loadingProgress}%</p>
          </div>
          <div className="w-48 h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Loading Error Notice */}
      {loadingError && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-4 z-20 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-sm text-rose-300 max-w-sm">{loadingError}</p>
          <button
            onClick={() => loadCharacterModel(selectedModelUrl)}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition border border-zinc-700 cursor-pointer"
          >
            Thử tải lại
          </button>
        </div>
      )}

      {/* Floating Instructions Guide */}
      {showHelp && !loading && (
        <div className="absolute top-16 left-4 max-w-xs p-3.5 rounded-2xl bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 text-xs text-zinc-300 space-y-2 z-10 shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between text-amber-400 font-bold border-b border-zinc-800 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Hướng dẫn điều khiển
            </span>
            <button onClick={() => setShowHelp(false)} className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="space-y-1.5 text-[11px] text-zinc-400">
            <li className="flex items-center justify-between">
              <span className="text-zinc-300">Di chuyển:</span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-200 text-[10px]">W / A / S / D hoặc Mũi tên</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-zinc-300">Chạy nhanh:</span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-200 text-[10px]">Giữ Shift hoặc bật Sprint</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-zinc-300">Xoay góc nhìn:</span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-200 text-[10px]">Kéo chuột / Chạm vuốt</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-zinc-300">Biểu cảm / Emote:</span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-200 text-[10px]">Phím 1, 2, 3 hoặc bấm nút</span>
            </li>
          </ul>
        </div>
      )}

      {/* Mobile Virtual Joystick (Bottom Left) */}
      {showControls && (
        <div className="absolute bottom-6 left-6 z-10 pointer-events-auto">
          <div
            ref={joystickContainerRef}
            onPointerDown={handleJoystickPointerDown}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickPointerUp}
            onPointerCancel={handleJoystickPointerUp}
            className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-zinc-900/60 backdrop-blur-md border-2 border-indigo-500/30 flex items-center justify-center touch-none shadow-2xl active:border-indigo-400"
            title="Kéo để di chuyển nhân vật"
          >
            {/* Compass guides */}
            <div className="absolute top-2 text-[9px] text-zinc-500 font-mono">W</div>
            <div className="absolute bottom-2 text-[9px] text-zinc-500 font-mono">S</div>
            <div className="absolute left-2 text-[9px] text-zinc-500 font-mono">A</div>
            <div className="absolute right-2 text-[9px] text-zinc-500 font-mono">D</div>

            {/* Crosshair lines */}
            <div className="absolute w-full h-[1px] bg-zinc-800/40" />
            <div className="absolute h-full w-[1px] bg-zinc-800/40" />

            {/* Draggable Stick Thumb */}
            <div
              className={`w-12 h-12 rounded-full border shadow-lg flex items-center justify-center transition-transform duration-75 ${
                isJoystickActive
                  ? 'bg-indigo-600 border-indigo-300 text-white scale-105 shadow-indigo-500/50'
                  : 'bg-zinc-800/90 border-zinc-600 text-zinc-300'
              }`}
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              }}
            >
              <Move className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons & Emotes (Bottom Right) */}
      {showControls && (
        <div className="absolute bottom-6 right-6 z-10 pointer-events-auto flex flex-col items-end gap-2.5">
          {/* Emotes Bar */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-950/80 backdrop-blur-md border border-zinc-800/90 shadow-xl">
            {Boolean(actionsRef.current['agree']) && (
              <button
                onClick={() => triggerEmote('agree')}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-emerald-600 text-zinc-200 hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                title="Đồng ý / Cổ vũ (Phím 1)"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Đồng ý / Cheer</span>
              </button>
            )}

            {Boolean(actionsRef.current['headshake']) && (
              <button
                onClick={() => triggerEmote('headshake')}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-rose-600 text-zinc-200 hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                title="Lắc đầu / Chặn đòn (Phím 2)"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Lắc đầu / Block</span>
              </button>
            )}

            {Boolean(actionsRef.current['sneak_pose']) && (
              <button
                onClick={() => triggerEmote('sneak_pose')}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-purple-600 text-zinc-200 hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                title="Rón rén / Né đòn (Phím 3)"
              >
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">Rón rén / Dodge</span>
              </button>
            )}
          </div>

          {/* Movement Toggles & Reset Position */}
          <div className="flex items-center gap-2">
            {/* Reset Position Button */}
            <button
              onClick={resetCharacterPosition}
              className="p-3 rounded-2xl bg-zinc-900/85 hover:bg-zinc-800 backdrop-blur-md border border-zinc-700/70 text-zinc-300 hover:text-white transition shadow-xl cursor-pointer"
              title="Đặt lại vị trí nhân vật (Phím R)"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Sprint Toggle Button */}
            <button
              onClick={() => setIsSprint(!isSprint)}
              className={`px-4 py-3 rounded-2xl border text-xs font-bold flex items-center gap-2 transition shadow-xl backdrop-blur-md cursor-pointer ${
                isSprint
                  ? 'bg-amber-600 border-amber-400 text-white shadow-amber-600/30 ring-2 ring-amber-500/40'
                  : 'bg-zinc-900/85 border-zinc-700/70 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {isSprint ? (
                <>
                  <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
                  <span>Chạy Nhanh [ON]</span>
                </>
              ) : (
                <>
                  <Footprints className="w-4 h-4 text-zinc-400" />
                  <span>Đi Bộ [Sprint OFF]</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Character3DViewer;
