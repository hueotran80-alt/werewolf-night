import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Sparkles,
  Shield,
  Moon,
  Flame,
  Zap,
  Footprints,
  RotateCcw,
  Compass,
  Eye,
  Users,
  Check,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Info,
  Activity,
  Gamepad2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Skull,
  Award,
  Layers,
  HelpCircle,
  Sun,
} from 'lucide-react';
import { Character3DViewer, ModelOption } from './Character3DViewer';
import { DayPhase3DViewer } from './DayPhase3DViewer';
import { ROLES_DATABASE } from '../data/rolesData';

export interface CharacterItem {
  id: string;
  name: string;
  vietnameseTitle: string;
  team: 'VILLAGE' | 'WEREWOLF' | 'NEUTRAL';
  teamName: string;
  badgeColor: string;
  borderColor: string;
  glowColor: string;
  modelUrl: string;
  avatarIcon: string;
  story: string;
  ability: string;
  roleObjective: string;
  stats: {
    speed: number;
    stealth: number;
    perception: number;
    combat: number;
  };
  supportedAnimations: {
    id: string;
    label: string;
    type: 'move' | 'emote';
    icon: string;
    hotkey?: string;
  }[];
}

export const PREVIEW_CHARACTERS: CharacterItem[] = [
  {
    id: 'knight-bodyguard',
    name: 'Bảo Vệ / Hiệp Sĩ (Knight 3D)',
    vietnameseTitle: 'Bảo Vệ Hoàng Gia',
    team: 'VILLAGE',
    teamName: 'Phe Dân Làng',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    borderColor: 'border-emerald-500/50',
    glowColor: 'rgba(16, 185, 129, 0.25)',
    modelUrl: '/models/Knight.glb',
    avatarIcon: '🛡️',
    story:
      'Hiệp sĩ bọc giáp kiên cường với thanh kiếm hộ vệ đêm trường. Mỗi đêm thức giấc che chở cho đồng đội khỏi nanh vuốt tàn khốc của ma sói.',
    ability: 'Mỗi đêm chọn chính mình hoặc 1 người để miễn nhiễm với mọi cái chết trong đêm.',
    roleObjective: 'Bảo toàn mạng sống cho Tiên Tri, Phù Thủy để lật đổ ách thống trị của Ma Sói.',
    stats: {
      speed: 75,
      stealth: 55,
      perception: 85,
      combat: 98,
    },
    supportedAnimations: [
      { id: 'idle', label: 'Tư thế thủ kiếm', type: 'move', icon: '🛡️' },
      { id: 'walk', label: 'Tuần tra đêm', type: 'move', icon: '⚔️' },
      { id: 'run', label: 'Xung phong hộ vệ', type: 'move', icon: '⚡' },
      { id: 'agree', label: 'Giao chiến / Chém', type: 'emote', icon: '⚔️', hotkey: '1' },
      { id: 'headShake', label: 'Đỡ khiên chống đỡ', type: 'emote', icon: '🛡️', hotkey: '2' },
      { id: 'sneak_pose', label: 'Hạ mình phục kích', type: 'emote', icon: '🤺', hotkey: '3' },
    ],
  },
  {
    id: 'mage-witch',
    name: 'Phù Thủy / Tiên Tri (Mage 3D)',
    vietnameseTitle: 'Phù Thủy Ánh Trăng',
    team: 'VILLAGE',
    teamName: 'Phe Dân Làng',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    borderColor: 'border-purple-500/50',
    glowColor: 'rgba(168, 85, 247, 0.25)',
    modelUrl: '/models/Mage.glb',
    avatarIcon: '🧙‍♀️',
    story:
      'Pháp sư bóng đêm nắm giữ hai thần dược huyền bí và quả cầu thấu thị linh hồn. Có khả năng xoay chuyển cục diện bàn cờ chỉ bằng một giọt độc dược.',
    ability: 'Sở hữu Bình Cứu Sinh và Bình Độc Dược; soi rọi chân tướng kẻ ác trong đêm đen.',
    roleObjective: 'Sử dụng chuẩn xác dược liệu vào thời khắc quyết định để cứu dân và thanh trừng sói.',
    stats: {
      speed: 70,
      stealth: 85,
      perception: 100,
      combat: 85,
    },
    supportedAnimations: [
      { id: 'idle', label: 'Niệm chú tĩnh tâm', type: 'move', icon: '✨' },
      { id: 'walk', label: 'Bước đi huyền bí', type: 'move', icon: '🔮' },
      { id: 'run', label: 'Lao tới giải cứu', type: 'move', icon: '💨' },
      { id: 'agree', label: 'Khai mở thần chú', type: 'emote', icon: '🌟', hotkey: '1' },
      { id: 'headShake', label: 'Chặn đứng ma thuật', type: 'emote', icon: '🚫', hotkey: '2' },
      { id: 'sneak_pose', label: 'Ẩn thân chiêm tinh', type: 'emote', icon: '🌙', hotkey: '3' },
    ],
  },
  {
    id: 'rogue-werewolf',
    name: 'Ma Sói / Sát Thủ (Rogue 3D)',
    vietnameseTitle: 'Sói Đêm / Sát Thủ',
    team: 'WEREWOLF',
    teamName: 'Phe Ma Sói',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    borderColor: 'border-rose-500/50',
    glowColor: 'rgba(244, 63, 94, 0.25)',
    modelUrl: '/models/Rogue.glb',
    avatarIcon: '🐺',
    story:
      'Chúa tể bóng đêm thoắt ẩn thoắt hiện với nanh vuốt khát máu. Ban ngày diễn vai người hiền từ, ban đêm tụ tập xé xác những linh hồn vô tội.',
    ability: 'Hội ý và chọn một nạn nhân để xé xác mỗi đêm; có khả năng diễn xuất đánh lừa dư luận.',
    roleObjective: 'Tiêu diệt số lượng dân làng cho đến khi phe Sói chiếm ưu thế áp đảo hoàn toàn.',
    stats: {
      speed: 95,
      stealth: 95,
      perception: 85,
      combat: 95,
    },
    supportedAnimations: [
      { id: 'idle', label: 'Rình mồi bóng đêm', type: 'move', icon: '🐺' },
      { id: 'walk', label: 'Săn mồi rón rén', type: 'move', icon: '🐾' },
      { id: 'run', label: 'Truy đuổi tàn nhẫn', type: 'move', icon: '⚡' },
      { id: 'agree', label: 'Đoạt mạng chớp nhoáng', type: 'emote', icon: '🗡️', hotkey: '1' },
      { id: 'headShake', label: 'Né đòn / Lắc đầu', type: 'emote', icon: '🎭', hotkey: '2' },
      { id: 'sneak_pose', label: 'Ẩn mình trong bóng tối', type: 'emote', icon: '👁️', hotkey: '3' },
    ],
  },
  {
    id: 'soldier-guard',
    name: 'Chiến Binh Làng (Soldier 3D)',
    vietnameseTitle: 'Dân Quân Tinh Nhuệ',
    team: 'VILLAGE',
    teamName: 'Phe Dân Làng',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    borderColor: 'border-amber-500/50',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    modelUrl: '/models/Soldier.glb',
    avatarIcon: '🪖',
    story:
      'Người lính gác can trường của ngôi làng u tối. Thức thâu đêm canh giữ cổng làng và sẵn sàng giương súng trước bất kỳ sinh vật lạ nào rình rập.',
    ability: 'Phát giác các dấu vết khả nghi ngoài cổng làng, dũng cảm đối chất trước đám đông.',
    roleObjective: 'Bảo vệ cư dân và tiêu diệt mọi mối hiểm họa xâm nhập ngôi làng.',
    stats: {
      speed: 80,
      stealth: 65,
      perception: 90,
      combat: 90,
    },
    supportedAnimations: [
      { id: 'idle', label: 'Đứng canh gác', type: 'move', icon: '🧍' },
      { id: 'walk', label: 'Đi tuần tra', type: 'move', icon: '🚶' },
      { id: 'run', label: 'Chạy khẩn cấp', type: 'move', icon: '🏃' },
      { id: 'agree', label: 'Chào điều lệnh', type: 'emote', icon: '🫡', hotkey: '1' },
      { id: 'headShake', label: 'Cảnh báo nguy hiểm', type: 'emote', icon: '⚠️', hotkey: '2' },
      { id: 'sneak_pose', label: 'Tư thế sẵn sàng', type: 'emote', icon: '🎯', hotkey: '3' },
    ],
  },
  {
    id: 'xbot-villager',
    name: 'Dân Làng Nam (Xbot 3D)',
    vietnameseTitle: 'Dân Làng Nam',
    team: 'VILLAGE',
    teamName: 'Phe Dân Làng',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    borderColor: 'border-blue-500/50',
    glowColor: 'rgba(59, 130, 246, 0.25)',
    modelUrl: '/models/Xbot.glb',
    avatarIcon: '👨‍🌾',
    story:
      'Người dân mộc mạc thức giấc giữa những tin đồn ma quái. Dù không có phép thuật, trí tuệ và sự đồng lòng của dân làng là vũ khí lớn nhất của công lý.',
    ability: 'Thảo luận và bỏ phiếu ban ngày; quan sát sắc bén phát hiện hành vi khả nghi.',
    roleObjective: 'Treo cổ tất cả Ma Sói để trả lại bình yên cho ngôi làng.',
    stats: {
      speed: 75,
      stealth: 60,
      perception: 85,
      combat: 55,
    },
    supportedAnimations: [
      { id: 'idle', label: 'Đứng chờ (Idle)', type: 'move', icon: '🧍' },
      { id: 'walk', label: 'Đi dạo quanh lửa', type: 'move', icon: '🚶' },
      { id: 'run', label: 'Chạy nước rút', type: 'move', icon: '🏃' },
      { id: 'agree', label: 'Gật đầu đồng ý', type: 'emote', icon: '👍', hotkey: '1' },
      { id: 'headShake', label: 'Lắc đầu phản đối', type: 'emote', icon: '🙅', hotkey: '2' },
      { id: 'sneak_pose', label: 'Rón rén trốn', type: 'emote', icon: '🕵️', hotkey: '3' },
    ],
  },
  {
    id: 'ybot-villager',
    name: 'Dân Làng Nữ (Ybot 3D)',
    vietnameseTitle: 'Dân Làng Nữ',
    team: 'VILLAGE',
    teamName: 'Phe Dân Làng',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    borderColor: 'border-pink-500/50',
    glowColor: 'rgba(236, 72, 153, 0.25)',
    modelUrl: '/models/Ybot.glb',
    avatarIcon: '👩‍🌾',
    story:
      'Cô gái nông dân thông minh và nhạy bén. Nhìn thấu những cử chỉ ngập ngừng và lời nói dối vụng về của những kẻ mang dã tâm trong làng.',
    ability: 'Phát hiện sự mâu thuẫn trong lời khai, bỏ phiếu chuẩn xác khi hội đồng mở phiên tòa.',
    roleObjective: 'Tìm ra kẻ chủ mưu và bảo vệ gia đình trước nanh vuốt loài sói.',
    stats: {
      speed: 75,
      stealth: 70,
      perception: 90,
      combat: 50,
    },
    supportedAnimations: [
      { id: 'idle', label: 'Đứng chờ dịu dàng', type: 'move', icon: '🧍‍♀️' },
      { id: 'walk', label: 'Bước đi thanh thoát', type: 'move', icon: '🚶‍♀️' },
      { id: 'run', label: 'Chạy nhanh lánh nạn', type: 'move', icon: '🏃‍♀️' },
      { id: 'agree', label: 'Đồng tình tán thành', type: 'emote', icon: '🌸', hotkey: '1' },
      { id: 'headShake', label: 'Nghi ngờ phản bác', type: 'emote', icon: '✋', hotkey: '2' },
      { id: 'sneak_pose', label: 'Lén lút nghe ngóng', type: 'emote', icon: '🤫', hotkey: '3' },
    ],
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialCharacterId?: string;
}

export const CharacterPreviewModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialCharacterId = 'xbot-villager',
}) => {
  const [selectedCharId, setSelectedCharId] = useState<string>(initialCharacterId);
  const [viewMode, setViewMode] = useState<'split' | 'fullscreen3D'>('split');
  const [sceneMode, setSceneMode] = useState<'night' | 'day'>('night');
  const [activeTab, setActiveTab] = useState<'info' | 'actions' | 'controls'>('info');
  const [activeEmoteNotification, setActiveEmoteNotification] = useState<string | null>(null);

  // Active virtual key press tracking for visual feedback
  const [virtualPressedKeys, setVirtualPressedKeys] = useState<{ [key: string]: boolean }>({});

  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentChar =
    PREVIEW_CHARACTERS.find((c) => c.id === selectedCharId) || PREVIEW_CHARACTERS[0];

  // Convert characters list to ModelOptions required by Character3DViewer
  const availableModels: ModelOption[] = PREVIEW_CHARACTERS.map((c) => ({
    id: c.id,
    name: c.vietnameseTitle,
    url: c.modelUrl,
    role: c.teamName,
    description: c.story,
  }));

  // ============================================================
  // DISPATCH SYNTHETIC KEYBOARD EVENTS TO 3D VIEWER
  // ============================================================
  const triggerKeyEvent = useCallback((code: string, isDown: boolean) => {
    setVirtualPressedKeys((prev) => ({ ...prev, [code]: isDown }));
    const eventType = isDown ? 'keydown' : 'keyup';
    window.dispatchEvent(
      new KeyboardEvent(eventType, {
        code,
        bubbles: true,
        cancelable: true,
      })
    );
  }, []);

  // Quick Emote Trigger with On-screen Banner Toast
  const triggerEmoteAction = useCallback((hotkey: string, label: string) => {
    const code = `Digit${hotkey}`;
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    }, 150);

    setActiveEmoteNotification(`Đã kích hoạt: ${label}`);
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setActiveEmoteNotification(null);
    }, 2200);
  }, []);

  // Quick Reset Position
  const handleResetPosition = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR', bubbles: true }));
    }, 100);

    setActiveEmoteNotification('Đã quay về vị trí trung tâm đống lửa');
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setActiveEmoteNotification(null);
    }, 2000);
  }, []);

  // Keyboard shortcut for closing (Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-7xl h-[92vh] sm:h-[90vh] bg-[#070B14] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">

        {/* Ambient Top Glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[200px] blur-3xl pointer-events-none transition-colors duration-700"
          style={{ backgroundColor: currentChar.glowColor }}
        />

        {/* ========================================================
            TOP BAR HEADER
        ======================================================== */}
        <header className="relative z-10 p-3 sm:p-4 border-b border-zinc-800/90 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-indigo-700 via-purple-700 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-indigo-950/60 flex-shrink-0">
              <span className="text-xl">{currentChar.avatarIcon}</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-serif font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                  <span>🏛️ PHÒNG THỬ NGHIỆM 3D</span>
                  <span className="hidden md:inline text-zinc-500 font-mono text-[11px] font-normal">
                    • WEREWOLF 3D PREVIEW
                  </span>
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  BETA 3D
                </span>
              </div>

              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Tương tác mô hình nhân vật trực quan, thử nghiệm động tác và điều khiển tự do quanh đống lửa nghi thức
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Scene Mode Toggle: Night Characters vs Day Village Deal */}
            <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-700/80">
              <button
                onClick={() => setSceneMode('night')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  sceneMode === 'night'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Không gian Đêm Ma Sói & Thử nghiệm Nhân vật"
              >
                <Moon className="w-3.5 h-3.5 text-indigo-300" />
                <span className="hidden sm:inline">🌙 Đêm</span>
              </button>
              <button
                onClick={() => setSceneMode('day')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  sceneMode === 'day'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Làng Ban Ngày & Quản Trò Chia Bài 3D"
              >
                <Sun className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">☀️ Ban Ngày</span>
              </button>
            </div>

            {/* View Mode Toggle: Split vs Full 3D */}
            <button
              onClick={() => setViewMode(viewMode === 'split' ? 'fullscreen3D' : 'split')}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/70 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
              title={viewMode === 'split' ? 'Xem rộng 3D' : 'Hiển thị bảng thông tin'}
            >
              {viewMode === 'split' ? (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden md:inline">Toàn Màn Hình 3D</span>
                </>
              ) : (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden md:inline">Hiện Thông Tin</span>
                </>
              )}
            </button>

            {/* Close / Return Button */}
            <button
              onClick={onClose}
              className="p-2 sm:px-3.5 sm:py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-rose-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-lg"
              title="Quay lại sảnh chính (Esc)"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Quay Lại Sảnh</span>
            </button>
          </div>
        </header>

        {/* ========================================================
            CHARACTER SELECTOR BAR (CAROUSEL / HORIZONTAL STRIP)
        ======================================================== */}
        <section className="relative z-10 border-b border-zinc-800/80 bg-zinc-950/60 px-3 sm:px-4 py-2.5 overflow-x-auto flex items-center gap-2.5 scrollbar-thin scrollbar-thumb-zinc-800">
          <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 uppercase tracking-wider pr-2 flex-shrink-0">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Nhân vật:</span>
          </div>

          {PREVIEW_CHARACTERS.map((char) => {
            const isSelected = char.id === selectedCharId;
            return (
              <button
                key={char.id}
                onClick={() => setSelectedCharId(char.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-xs font-medium transition-all flex-shrink-0 active:scale-95 ${
                  isSelected
                    ? `${char.borderColor} bg-zinc-900/90 text-white shadow-lg ring-1 ring-white/10 font-bold`
                    : 'border-zinc-800/80 bg-zinc-900/30 text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                }`}
              >
                <span className="text-base">{char.avatarIcon}</span>
                <div className="text-left">
                  <div className="leading-tight">{char.vietnameseTitle}</div>
                  <div className="text-[9px] text-zinc-500 font-normal leading-none mt-0.5">
                    {char.teamName}
                  </div>
                </div>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-1" />
                )}
              </button>
            );
          })}
        </section>

        {/* ========================================================
            BODY WORKSPACE: 3D VIEWPORT & HUD PANELS
        ======================================================== */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative">

          {/* Toast Emote Notification */}
          {activeEmoteNotification && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl bg-zinc-950/90 border border-amber-500/50 text-amber-300 text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{activeEmoteNotification}</span>
            </div>
          )}

          {/* ======================================================
              LEFT/MAIN: THREE.JS 3D VIEWPORT CANVAS
          ====================================================== */}
          <div
            className={`relative h-full transition-all duration-300 ${
              viewMode === 'split' ? 'lg:col-span-8 xl:col-span-8' : 'lg:col-span-12'
            }`}
          >
            {sceneMode === 'day' ? (
              <DayPhase3DViewer
                className="w-full h-full"
                playerRole={
                  currentChar.team === 'WEREWOLF'
                    ? 'WEREWOLF'
                    : currentChar.team === 'VILLAGE' && currentChar.vietnameseTitle.includes('Tiên Tri')
                    ? 'SEER'
                    : currentChar.team === 'VILLAGE' && currentChar.vietnameseTitle.includes('Thợ Săn')
                    ? 'HUNTER'
                    : 'VILLAGER'
                }
                playerName={currentChar.vietnameseTitle}
              />
            ) : (
              <>
                {/* The 3D Component Built By Dev 2 */}
                <Character3DViewer
                  modelUrl={currentChar.modelUrl}
                  availableModels={availableModels}
                  onModelChange={(m) => {
                    const found = PREVIEW_CHARACTERS.find((c) => c.modelUrl === m.url || c.id === m.id);
                    if (found) setSelectedCharId(found.id);
                  }}
                  className="w-full h-full"
                  title={`${currentChar.vietnameseTitle} - Không Gian Thử Nghiệm 3D`}
                  showControls={true}
                />

                {/* On-Screen Mobile Virtual D-Pad Overlay (Extra Convenience on Top of Joystick) */}
                <div className="absolute bottom-6 right-28 sm:right-32 z-10 flex flex-col items-center gap-1 pointer-events-auto opacity-80 hover:opacity-100 transition-opacity">
                  <div className="text-[9px] text-zinc-400 font-mono text-center uppercase tracking-wider mb-0.5 hidden sm:block">
                    Điều Khiển Ảo
                  </div>
                  {/* Up */}
                  <button
                    onPointerDown={() => triggerKeyEvent('KeyW', true)}
                    onPointerUp={() => triggerKeyEvent('KeyW', false)}
                    onPointerLeave={() => triggerKeyEvent('KeyW', false)}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-90 ${
                      virtualPressedKeys['KeyW']
                        ? 'bg-amber-600 border-amber-400 text-white'
                        : 'bg-zinc-900/80 border-zinc-700/70 text-zinc-300 hover:bg-zinc-800'
                    }`}
                    title="Tiến lên (W)"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>

                  {/* Left / Down / Right */}
                  <div className="flex items-center gap-1">
                    <button
                      onPointerDown={() => triggerKeyEvent('KeyA', true)}
                      onPointerUp={() => triggerKeyEvent('KeyA', false)}
                      onPointerLeave={() => triggerKeyEvent('KeyA', false)}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-90 ${
                        virtualPressedKeys['KeyA']
                          ? 'bg-amber-600 border-amber-400 text-white'
                          : 'bg-zinc-900/80 border-zinc-700/70 text-zinc-300 hover:bg-zinc-800'
                      }`}
                      title="Rẽ trái (A)"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <button
                      onPointerDown={() => triggerKeyEvent('KeyS', true)}
                      onPointerUp={() => triggerKeyEvent('KeyS', false)}
                      onPointerLeave={() => triggerKeyEvent('KeyS', false)}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-90 ${
                        virtualPressedKeys['KeyS']
                          ? 'bg-amber-600 border-amber-400 text-white'
                          : 'bg-zinc-900/80 border-zinc-700/70 text-zinc-300 hover:bg-zinc-800'
                      }`}
                      title="Lùi lại (S)"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>

                    <button
                      onPointerDown={() => triggerKeyEvent('KeyD', true)}
                      onPointerUp={() => triggerKeyEvent('KeyD', false)}
                      onPointerLeave={() => triggerKeyEvent('KeyD', false)}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-90 ${
                        virtualPressedKeys['KeyD']
                          ? 'bg-amber-600 border-amber-400 text-white'
                          : 'bg-zinc-900/80 border-zinc-700/70 text-zinc-300 hover:bg-zinc-800'
                      }`}
                      title="Rẽ phải (D)"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Central Reset Position Trigger (Top Left Float) */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                  <button
                    onClick={handleResetPosition}
                    className="px-3 py-1.5 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 shadow-lg backdrop-blur-md transition active:scale-95"
                    title="Đưa nhân vật về tâm đống lửa (Phím R)"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Về Tâm Đống Lửa</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ======================================================
              RIGHT HUD / SIDEBAR: CHARACTER DETAILS, STATS & EMOTES
          ====================================================== */}
          {viewMode === 'split' && (
            <div className="lg:col-span-4 xl:col-span-4 border-t lg:border-t-0 lg:border-l border-zinc-800/90 bg-[#080C16] flex flex-col h-full overflow-hidden">

              {/* Sub-Tabs Header */}
              <div className="p-3 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-1">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'info'
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Hồ Sơ Vai Trò</span>
                </button>

                <button
                  onClick={() => setActiveTab('actions')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'actions'
                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Động Tác Test</span>
                </button>

                <button
                  onClick={() => setActiveTab('controls')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'controls'
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span>Phím Tắt</span>
                </button>
              </div>

              {/* Tab Contents Scrollable Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">

                {/* TAB 1: ROLE INFO & RPG STATS */}
                {activeTab === 'info' && (
                  <div className="space-y-4">
                    {/* Header Card */}
                    <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2 relative overflow-hidden">
                      <div
                        className="absolute top-0 right-0 w-24 h-24 blur-2xl pointer-events-none"
                        style={{ backgroundColor: currentChar.glowColor }}
                      />

                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${currentChar.badgeColor}`}>
                          {currentChar.teamName}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">ID: {currentChar.id}</span>
                      </div>

                      <h3 className="text-lg font-bold text-white font-serif tracking-wide">
                        {currentChar.vietnameseTitle}
                      </h3>

                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {currentChar.story}
                      </p>
                    </div>

                    {/* Objective & Ability */}
                    <div className="p-3.5 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 space-y-2 text-xs">
                      <div>
                        <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                          🎯 Mục Tiêu Sống Còn
                        </div>
                        <p className="text-zinc-300">{currentChar.roleObjective}</p>
                      </div>

                      <div className="border-t border-zinc-800/60 pt-2">
                        <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
                          ⚡ Kỹ Năng Nổi Bật
                        </div>
                        <p className="text-zinc-300">{currentChar.ability}</p>
                      </div>
                    </div>

                    {/* RPG Character Attribute Bars */}
                    <div className="p-3.5 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 space-y-2.5">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Chỉ Số Nhân Vật Thử Nghiệm</span>
                        <Activity className="w-3.5 h-3.5 text-zinc-500" />
                      </div>

                      {/* Speed */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                          <span>Tốc Độ Di Chuyển</span>
                          <span className="text-zinc-200">{currentChar.stats.speed} / 100</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                            style={{ width: `${currentChar.stats.speed}%` }}
                          />
                        </div>
                      </div>

                      {/* Stealth */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                          <span>Ngụy Trang & Ẩn Thân</span>
                          <span className="text-zinc-200">{currentChar.stats.stealth} / 100</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500"
                            style={{ width: `${currentChar.stats.stealth}%` }}
                          />
                        </div>
                      </div>

                      {/* Perception */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                          <span>Trực Giác & Phán Đoán</span>
                          <span className="text-zinc-200">{currentChar.stats.perception} / 100</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-rose-400 transition-all duration-500"
                            style={{ width: `${currentChar.stats.perception}%` }}
                          />
                        </div>
                      </div>

                      {/* Combat */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                          <span>Khả Năng Sinh Tồn / Chiến Đấu</span>
                          <span className="text-zinc-200">{currentChar.stats.combat} / 100</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                            style={{ width: `${currentChar.stats.combat}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ANIMATIONS & EMOTES TESTER */}
                {activeTab === 'actions' && (
                  <div className="space-y-3.5">
                    <div className="text-xs text-zinc-400">
                      Bấm các nút dưới đây để ép nhân vật thực hiện ngay lập tức các động tác và biểu cảm:
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Động Tác Biểu Cảm (Emotes)
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {currentChar.supportedAnimations
                          .filter((a) => a.type === 'emote')
                          .map((anim) => (
                            <button
                              key={anim.id}
                              onClick={() => triggerEmoteAction(anim.hotkey || '1', anim.label)}
                              className="w-full p-2.5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/50 flex items-center justify-between text-xs text-zinc-200 transition group active:scale-95"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-base">{anim.icon}</span>
                                <span className="font-semibold">{anim.label}</span>
                              </div>
                              {anim.hotkey && (
                                <span className="px-2 py-0.5 rounded-md bg-zinc-800 font-mono text-[10px] text-zinc-400 group-hover:text-amber-300">
                                  Phím {anim.hotkey}
                                </span>
                              )}
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Tư Thế Di Chuyển (Locomotion)
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <button
                          onClick={() => {
                            triggerKeyEvent('KeyW', true);
                            setTimeout(() => triggerKeyEvent('KeyW', false), 800);
                          }}
                          className="w-full p-2.5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between text-xs text-zinc-200 transition group active:scale-95"
                        >
                          <div className="flex items-center gap-2.5">
                            <Footprints className="w-4 h-4 text-cyan-400" />
                            <span>Bước Tới Phía Trước (Walk 1 nhịp)</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 font-mono text-[10px] text-zinc-400">
                            W / ↑
                          </span>
                        </button>

                        <button
                          onClick={handleResetPosition}
                          className="w-full p-2.5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between text-xs text-zinc-200 transition group active:scale-95"
                        >
                          <div className="flex items-center gap-2.5">
                            <RotateCcw className="w-4 h-4 text-rose-400" />
                            <span>Đứng Yên Tại Chỗ (Reset Idle)</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 font-mono text-[10px] text-zinc-400">
                            R
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: CONTROLS & SHORTCUTS GUIDE */}
                {activeTab === 'controls' && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-2.5">
                      <div className="font-bold text-white flex items-center gap-2">
                        <Gamepad2 className="w-4 h-4 text-emerald-400" />
                        <span>Bàn Phím & Chuột (Desktop)</span>
                      </div>
                      <ul className="space-y-2 text-zinc-400 text-[11px]">
                        <li className="flex justify-between items-center pb-1 border-b border-zinc-800/60">
                          <span className="text-zinc-300">W / A / S / D hoặc Mũi Tên</span>
                          <span className="text-zinc-200 font-mono">Di chuyển 4 hướng</span>
                        </li>
                        <li className="flex justify-between items-center pb-1 border-b border-zinc-800/60">
                          <span className="text-zinc-300">Shift</span>
                          <span className="text-zinc-200 font-mono">Chạy nhanh (Sprint)</span>
                        </li>
                        <li className="flex justify-between items-center pb-1 border-b border-zinc-800/60">
                          <span className="text-zinc-300">Kéo Chuột Trái</span>
                          <span className="text-zinc-200 font-mono">Xoay camera 360°</span>
                        </li>
                        <li className="flex justify-between items-center pb-1 border-b border-zinc-800/60">
                          <span className="text-zinc-300">Cuộn Chuột</span>
                          <span className="text-zinc-200 font-mono">Phóng to / Thu nhỏ</span>
                        </li>
                        <li className="flex justify-between items-center pb-1 border-b border-zinc-800/60">
                          <span className="text-zinc-300">Phím 1, 2, 3</span>
                          <span className="text-zinc-200 font-mono">Kích hoạt biểu cảm</span>
                        </li>
                        <li className="flex justify-between items-center">
                          <span className="text-zinc-300">Phím R</span>
                          <span className="text-zinc-200 font-mono">Về tâm đống lửa</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-2.5">
                      <div className="font-bold text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span>Màn Hình Cảm Ứng (Mobile / Tablet)</span>
                      </div>
                      <ul className="space-y-2 text-zinc-400 text-[11px]">
                        <li className="flex justify-between items-center pb-1 border-b border-zinc-800/60">
                          <span className="text-zinc-300">Cần ảo Joystick góc dưới trái</span>
                          <span className="text-zinc-200 font-mono">Kéo để di chuyển mượt</span>
                        </li>
                        <li className="flex justify-between items-center pb-1 border-b border-zinc-800/60">
                          <span className="text-zinc-300">Chạm và vuốt màn hình</span>
                          <span className="text-zinc-200 font-mono">Xoay góc nhìn camera</span>
                        </li>
                        <li className="flex justify-between items-center pb-1 border-b border-zinc-800/60">
                          <span className="text-zinc-300">Cụm D-pad ảo góc dưới phải</span>
                          <span className="text-zinc-200 font-mono">Nút bấm hướng tức thì</span>
                        </li>
                        <li className="flex justify-between items-center">
                          <span className="text-zinc-300">Thanh Emote góc phải</span>
                          <span className="text-zinc-200 font-mono">Bấm trực tiếp để diễn</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/80 text-center">
                <p className="text-[10px] text-zinc-500 font-mono">
                  Mô hình 3D tối ưu hóa WebGL • Tương thích mọi trình duyệt
                </p>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default CharacterPreviewModal;
