import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Sun,
  Moon,
  Sparkles,
  Eye,
  EyeOff,
  RotateCcw,
  Layers,
  Maximize2,
  Minimize2,
  ChevronRight,
  Info,
  CheckCircle2,
  Award,
  Camera,
  Play,
  ShieldCheck
} from 'lucide-react';
import { DayPhase3DViewer, DayPhase3DViewerHandle, SequencePhase, CameraMode } from './DayPhase3DViewer';
import { RoleId } from '../types';

interface RoleInspectorItem {
  id: RoleId;
  name: string;
  vietnameseTitle: string;
  team: 'VILLAGE' | 'WEREWOLF';
  teamName: string;
  badgeClass: string;
  borderClass: string;
  glowColor: string;
  cardImage: string;
  avatarIcon: string;
  shortDesc: string;
  secretGuide: string;
  dayStrategy: string;
}

const INSPECTOR_ROLES: RoleInspectorItem[] = [
  {
    id: 'WEREWOLF',
    name: 'Ma Sói (Werewolf)',
    vietnameseTitle: 'Chúa Tể Bóng Đêm',
    team: 'WEREWOLF',
    teamName: 'Phe Ma Sói',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    borderClass: 'border-rose-500/50 hover:border-rose-400',
    glowColor: 'rgba(244, 63, 94, 0.35)',
    cardImage: '/cards/werewolf.png',
    avatarIcon: '🐺',
    shortDesc: 'Ẩn náu giữa bầy cừu, ban đêm cắn xé dân làng, ban ngày diễn xuất đánh lạc hướng.',
    secretGuide: 'Nếu bốc trúng Sói: Giữ nét mặt bình thản, ghi nhớ đồng bọn sói đêm nay, úp bài nhanh gọn.',
    dayStrategy: 'Hòa nhập với dân, nói chuyện tự nhiên, đừng quá im lặng cũng đừng công kích lộ liễu.',
  },
  {
    id: 'SEER',
    name: 'Tiên Tri (Seer)',
    vietnameseTitle: 'Mắt Thần Thấu Thị',
    team: 'VILLAGE',
    teamName: 'Phe Dân Làng',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    borderClass: 'border-cyan-500/50 hover:border-cyan-400',
    glowColor: 'rgba(6, 182, 212, 0.35)',
    cardImage: '/cards/seer.png',
    avatarIcon: '🔮',
    shortDesc: 'Mỗi đêm soi linh hồn 1 người chơi để biết chính xác đó là Sói hay Dân Làng.',
    secretGuide: 'Nếu bốc trúng Tiên Tri: Tuyệt đối không để lộ biểu cảm kinh ngạc hay nháy mắt.',
    dayStrategy: 'Khéo léo điều hướng bỏ phiếu mà không để Ma Sói phát hiện bạn chính là Tiên Tri.',
  },
  {
    id: 'BODYGUARD',
    name: 'Bảo Vệ (Bodyguard)',
    vietnameseTitle: 'Hộ Vệ Hoàng Gia',
    team: 'VILLAGE',
    teamName: 'Phe Dân Làng',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    borderClass: 'border-emerald-500/50 hover:border-emerald-400',
    glowColor: 'rgba(16, 185, 129, 0.35)',
    cardImage: '/cards/bodyguard.png',
    avatarIcon: '🛡️',
    shortDesc: 'Mỗi đêm chọn bảo vệ 1 người (kể cả bản thân) miễn nhiễm cái chết đêm đó.',
    secretGuide: 'Nếu bốc trúng Bảo Vệ: Tấm khiên sinh mệnh của làng, cẩn trọng giữ bài.',
    dayStrategy: 'Lắng nghe xem ai có khả năng là Tiên Tri hoặc người có ích để đêm tới bảo vệ.',
  },
  {
    id: 'VILLAGER',
    name: 'Dân Làng (Villager)',
    vietnameseTitle: 'Cư Dân Lương Thiện',
    team: 'VILLAGE',
    teamName: 'Phe Dân Làng',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    borderClass: 'border-blue-500/50 hover:border-blue-400',
    glowColor: 'rgba(59, 130, 246, 0.35)',
    cardImage: '/cards/villager.png',
    avatarIcon: '🌾',
    shortDesc: 'Vũ khí mạnh nhất là khối óc suy luận sắc bén và lá phiếu dân chủ ban ngày.',
    secretGuide: 'Nếu bốc trúng Dân Làng: Đừng thất vọng! Bạn có thể liều mình thử lòng mọi người.',
    dayStrategy: 'Tập trung quan sát cử chỉ bất thường của người khác khi lật bài và bỏ phiếu.',
  },
];

export interface DayPhasePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNightPreview?: () => void;
}

export const DayPhasePreviewModal: React.FC<DayPhasePreviewModalProps> = ({
  isOpen,
  onClose,
  onOpenNightPreview,
}) => {
  const viewerRef = useRef<DayPhase3DViewerHandle | null>(null);

  // States
  const [currentPhase, setCurrentPhase] = useState<SequencePhase>('ready');
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview');
  const [selectedRole, setSelectedRole] = useState<RoleId>('SEER');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showGuideBanner, setShowGuideBanner] = useState<boolean>(true);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Action Bar Handlers
  const handleDealCards = useCallback(() => {
    viewerRef.current?.dealCards();
  }, []);

  const handleInspectCard = useCallback(() => {
    // Tự động kích hoạt góc nhìn cá nhân (POV) để người chơi xem bài trực diện
    viewerRef.current?.switchCameraMode('pov');
    setCameraMode('pov');
    viewerRef.current?.pickAndInspectCards();
  }, []);

  const handlePlaceFaceDown = useCallback(() => {
    viewerRef.current?.placeCardsFaceDown();
  }, []);

  const handleReset = useCallback(() => {
    viewerRef.current?.resetCards();
    viewerRef.current?.switchCameraMode('overview');
    setCameraMode('overview');
  }, []);

  const handleToggleCamera = useCallback(() => {
    const nextMode = cameraMode === 'overview' ? 'pov' : 'overview';
    viewerRef.current?.switchCameraMode(nextMode);
    setCameraMode(nextMode);
  }, [cameraMode]);

  const handleRunAuto = useCallback(() => {
    viewerRef.current?.runAutoSequence();
  }, []);

  if (!isOpen) return null;

  const currentRoleInfo = INSPECTOR_ROLES.find((r) => r.id === selectedRole) || INSPECTOR_ROLES[1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div
        className={`relative w-full max-w-7xl bg-slate-950/95 border border-amber-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen ? 'fixed inset-2 max-w-none h-[calc(100vh-16px)]' : 'h-[92vh] max-h-[960px]'
        }`}
        style={{
          boxShadow: '0 0 50px rgba(245, 158, 11, 0.15), 0 20px 40px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* ========================================================
            TOP BAR HEADER
        ======================================================== */}
        <header className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
          {/* Left Title & Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-inner">
              <Sun className="w-5 h-5 animate-spin-slow" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-serif font-black tracking-wide text-white uppercase flex items-center gap-2">
                  <span>TRẢI NGHIỆM BAN NGÀY & CHIA BÀI 3D</span>
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  DEMO TƯƠNG TÁC
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-1">
                Giai đoạn phát bài bí mật & xác nhận danh tính trước giờ tranh luận
              </p>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2">
            {/* Quick Switch to Night 3D if callback exists */}
            {onOpenNightPreview && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNightPreview();
                }}
                className="hidden md:flex px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-purple-200 text-xs font-semibold items-center gap-1.5 transition active:scale-95 cursor-pointer"
                title="Chuyển sang Không Gian Ban Đêm 3D"
              >
                <Moon className="w-3.5 h-3.5 text-purple-400" />
                <span>Sang Ban Đêm 3D</span>
              </button>
            )}

            {/* Toggle Fullscreen */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-zinc-300 transition cursor-pointer"
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/60 text-rose-300 transition active:scale-95 cursor-pointer"
              title="Đóng / Quay lại trang chủ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ========================================================
            EXPLANATORY PROCESS BANNER (THÔNG BÁO GIẢI THÍCH QUY TRÌNH)
        ======================================================== */}
        {showGuideBanner && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-amber-950/40 border-b border-amber-500/20 flex items-center justify-between gap-3 text-xs text-zinc-300 shrink-0">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className="p-1 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
                <Info className="w-4 h-4" />
              </span>
              <span className="font-semibold text-amber-200">
                Quy trình Ban Ngày:
              </span>
              <span className="text-[11px] text-zinc-300 truncate">
                Quản trò phát thẻ bài bí mật cho từng người ➔ Người chơi cầm bài lật lên xem vai trò ➔ Úp thẻ bài xuống đất an toàn ➔ Chuông reo mở mắt bước vào tranh luận!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowGuideBanner(false)}
              className="text-zinc-500 hover:text-zinc-300 p-1 shrink-0 cursor-pointer"
              title="Ẩn thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================
            MAIN BODY: 3D VIEWPORT & CARD ROLE INSPECTOR
        ======================================================== */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Left/Center: 3D Viewport with Dev 2's DayPhase3DViewer */}
          <div className="flex-1 relative flex flex-col min-h-[380px] bg-slate-950">
            <DayPhase3DViewer
              ref={viewerRef}
              className="w-full h-full"
              playerRole={selectedRole}
              playerName="Bạn"
              isHost={true}
              showInternalControls={false}
              privacyShieldEnabled={false}
              onPhaseChange={setCurrentPhase}
              onCameraModeChange={setCameraMode}
            />

            {/* In-Canvas Notification Overlay on active step & Privacy Status */}
            <div className="absolute top-4 left-4 pointer-events-none z-10 flex flex-col gap-2 max-w-sm sm:max-w-md">
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-white shadow-xl flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-[11px] font-bold">
                  {currentPhase === 'ready' && 'Bước 0: Cỗ bài sẵn sàng tại bục Quản Trò'}
                  {currentPhase === 'dealing' && 'Bước 1: Quản Trò Đang Chia Bài Đến Từng Người...'}
                  {currentPhase === 'dealt' && 'Bước 2: Bài đã phát đến từng chỗ ngồi - Hãy Cầm Lên Xem'}
                  {currentPhase === 'inspecting' && 'Bước 3: Đang Cầm Thẻ Lên Xem Vai Trò Bí Mật'}
                  {currentPhase === 'facedown' && 'Bước 4: Đã Úp Thẻ Xuống Đất - Sẵn Sàng Tranh Luận'}
                </span>
              </div>

              {/* Security Warning & Privacy Badge */}
              <div className="px-3.5 py-2.5 rounded-2xl backdrop-blur-md border shadow-2xl text-white transition-all duration-300 flex items-start gap-2.5 bg-slate-950/90 border-amber-500/40 shadow-slate-950/70">
                <div className="p-1.5 rounded-xl shrink-0 mt-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-400/40">
                      🔒 BẢO MẬT CÁ NHÂN
                    </span>
                    {cameraMode === 'pov' ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 animate-pulse">
                        🎥 Đang ở Góc Cam Cá Nhân
                      </span>
                    ) : (
                      <span className="text-[9px] text-zinc-400">
                        🌐 Góc Toàn Cảnh Làng
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold leading-tight text-emerald-200">
                    🔒 Bảo Mật Cá Nhân: Bạn xem vai trò qua góc cam riêng. Lá bài của người khác luôn giữ mặt úp, không bị lộ vai trò!
                  </p>
                  <p className="text-[10px] text-zinc-300 mt-1">
                    Chỉ có bạn mới nhìn thấy mặt vai trò lá bài của mình qua góc cam riêng. Lá bài của người khác luôn giữ mặt úp hoặc che giấu!
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Controls on 3D Stage: Camera Switcher Button */}
            <div className="absolute top-4 right-4 z-10 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleCamera}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer border ${
                  cameraMode === 'pov'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-black border-amber-300 ring-2 ring-amber-400/40 shadow-amber-950/60'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-amber-300 border-amber-500/40 shadow-slate-950/60'
                }`}
                title={cameraMode === 'pov' ? 'Chuyển về Toàn cảnh bàn tròn' : 'Chuyển sang Góc nhìn cá nhân'}
              >
                <Camera className={`w-4 h-4 ${cameraMode === 'pov' ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>
                  {cameraMode === 'pov'
                    ? '🎥 Góc Cam Cá Nhân (Xem Bài Riêng Tư)'
                    : '🎥 Chuyển Sang Góc Cam Cá Nhân'}
                </span>
              </button>
            </div>

            {/* POV Personal Mode Indicator & Guidance */}
            {cameraMode === 'pov' && (
              <div className="absolute bottom-4 left-4 z-15 max-w-sm p-3.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-amber-500/30 shadow-2xl text-white animate-fade-in pointer-events-auto">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs uppercase tracking-wide mb-1">
                  <Camera className="w-3.5 h-3.5" />
                  <span>🎥 Góc Nhìn Riêng Tư (Góc Cam Cá Nhân)</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  🔒 Bảo Mật Cá Nhân: Chỉ có bạn mới nhìn thấy mặt vai trò lá bài của mình qua góc cam riêng. Lá bài của người khác luôn giữ mặt úp hoặc che giấu!
                </p>
              </div>
            )}
          </div>

          {/* Right Panel: CARD ROLE INSPECTOR */}
          <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800/80 bg-slate-900/90 backdrop-blur-md flex flex-col shrink-0 overflow-y-auto">
            {/* Inspector Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  BỘ THẺ BÀI & SOI VAI TRÒ
                </h2>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                Click để đổi thẻ 3D
              </span>
            </div>

            {/* Role Tab Selector (4 key roles: Sói, Tiên tri, Bảo vệ, Dân làng) */}
            <div className="p-3 grid grid-cols-2 gap-2 border-b border-slate-800/60 bg-slate-950/40">
              {INSPECTOR_ROLES.map((role) => {
                const isSelected = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setSelectedRole(role.id);
                      viewerRef.current?.switchCameraMode('pov');
                      setCameraMode('pov');
                      if (currentPhase === 'ready') {
                        viewerRef.current?.dealCards();
                        setTimeout(() => {
                          viewerRef.current?.pickAndInspectCards();
                        }, 1800);
                      } else if (currentPhase !== 'inspecting') {
                        viewerRef.current?.pickAndInspectCards();
                      }
                    }}
                    className={`p-2.5 rounded-2xl text-left border transition-all flex items-center gap-2.5 cursor-pointer active:scale-95 ${
                      isSelected
                        ? `${role.borderClass} bg-slate-800/90 shadow-lg ring-1 ring-amber-400/50`
                        : 'border-slate-800 bg-slate-900/50 hover:bg-slate-850 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <span className="text-lg">{role.avatarIcon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        {role.vietnameseTitle}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {role.teamName}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Card Spotlight Detail */}
            <div className="p-4 flex-1 flex flex-col space-y-4">
              {/* Card Image Realistic Preview */}
              <div className="relative mx-auto w-44 h-64 rounded-2xl overflow-hidden border-2 border-amber-400/40 shadow-2xl group transition-transform duration-300 hover:scale-105">
                <img
                  src={currentRoleInfo.cardImage}
                  alt={currentRoleInfo.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent flex flex-col justify-end p-3">
                  <span className={`self-start px-2 py-0.5 rounded-full text-[9px] font-bold border mb-1 ${currentRoleInfo.badgeClass}`}>
                    {currentRoleInfo.teamName}
                  </span>
                  <div className="text-sm font-bold text-white font-serif">
                    {currentRoleInfo.vietnameseTitle}
                  </div>
                </div>
              </div>

              {/* Role Lore & Skills info */}
              <div className="space-y-2.5 text-left bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    Đặc tính vai trò
                  </div>
                  <p className="text-xs text-zinc-200 mt-0.5 leading-relaxed">
                    {currentRoleInfo.shortDesc}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60">
                  <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Bí kíp khi lật bài (Secret Peek)
                  </div>
                  <p className="text-[11px] text-amber-200/90 mt-0.5 leading-relaxed">
                    {currentRoleInfo.secretGuide}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60">
                  <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    Chiến thuật Ban Ngày
                  </div>
                  <p className="text-[11px] text-cyan-200/90 mt-0.5 leading-relaxed">
                    {currentRoleInfo.dayStrategy}
                  </p>
                </div>
              </div>

              {/* POV Camera & Personal Security Info */}
              <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Góc Nhìn & Bảo Mật
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      cameraMode === 'pov'
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-slate-800 border-slate-700 text-zinc-300 hover:bg-slate-750'
                    }`}
                  >
                    {cameraMode === 'pov' ? '🎥 Góc POV' : '🌐 Toàn Cảnh'}
                  </button>
                </div>

                <div className="text-[11px] text-zinc-300 space-y-1.5">
                  <div className="text-emerald-300 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Bảo Mật Cá Nhân Tuyệt Đối</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    🔒 Bảo Mật Cá Nhân: Bạn xem vai trò qua góc cam riêng. Lá bài của người khác luôn giữ mặt úp, không bị lộ vai trò!
                  </p>
                  <p className="text-[10px] text-amber-300/80 leading-relaxed">
                    💡 Khi bấm "2. Cầm Lên Xem Vai Trò", camera tự động kích hoạt góc nhìn cá nhân (POV) để người chơi xem bài trực diện.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            BOTTOM TIMELINE & ACTION BAR
        ======================================================== */}
        <footer className="p-4 border-t border-slate-800/90 bg-slate-900/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left: Step Breadcrumb Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-zinc-400">
            <span className={currentPhase === 'ready' ? 'text-amber-400 font-bold' : ''}>
              1. Cỗ bài sẵn sàng
            </span>
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            <span className={currentPhase === 'dealing' ? 'text-amber-400 font-bold' : ''}>
              2. Đang chia bài
            </span>
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            <span className={currentPhase === 'inspecting' ? 'text-rose-400 font-bold' : ''}>
              3. Xem vai trò
            </span>
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            <span className={currentPhase === 'facedown' ? 'text-emerald-400 font-bold' : ''}>
              4. Úp bài an toàn
            </span>
          </div>

          {/* Center: Action Buttons 1, 2, 3, 4 */}
          <div className="flex flex-wrap items-center gap-2.5 mx-auto sm:mx-0">
            {/* Nút 1: Quản Trò Chia Bài */}
            <button
              type="button"
              onClick={handleDealCards}
              disabled={currentPhase === 'dealing'}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer ${
                currentPhase === 'dealing'
                  ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 text-slate-950 font-black ring-2 ring-amber-300'
                  : 'bg-slate-800/90 hover:bg-slate-750 text-amber-300 border border-amber-500/40'
              }`}
            >
              <span>🃏 1. Quản Trò Chia Bài</span>
            </button>

            {/* Nút 2: Cầm Lên Xem Vai Trò */}
            <button
              type="button"
              onClick={handleInspectCard}
              disabled={currentPhase === 'ready' || currentPhase === 'dealing'}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer ${
                currentPhase === 'inspecting'
                  ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white font-black ring-2 ring-rose-400 shadow-rose-950/50 animate-pulse'
                  : 'bg-slate-800/90 hover:bg-slate-750 text-zinc-200 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <Eye className="w-4 h-4 text-amber-400" />
              <span>👀 2. Cầm Lên Xem Vai Trò</span>
            </button>

            {/* Nút 3: Đặt Úp Thẻ Xuống Đất */}
            <button
              type="button"
              onClick={handlePlaceFaceDown}
              disabled={currentPhase === 'ready' || currentPhase === 'dealing'}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer ${
                currentPhase === 'facedown'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black ring-2 ring-emerald-400 shadow-emerald-950/50'
                  : 'bg-slate-800/90 hover:bg-slate-750 text-zinc-200 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <EyeOff className="w-4 h-4 text-emerald-400" />
              <span>⬇️ 3. Đặt Úp Thẻ Xuống Đất</span>
            </button>

            {/* Nút 4: Làm Lại Từ Đầu */}
            <button
              type="button"
              onClick={handleReset}
              className="p-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-750 text-zinc-300 hover:text-white border border-slate-700 transition shadow-lg active:scale-95 cursor-pointer"
              title="Làm lại từ đầu"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
            </button>

            {/* Nút Kịch Bản Tự Động */}
            <button
              type="button"
              onClick={handleRunAuto}
              className="px-3.5 py-2.5 rounded-2xl bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg"
              title="Trình diễn kịch bản hoàn chỉnh từ A đến Z"
            >
              <Play className="w-3.5 h-3.5 fill-current text-indigo-400" />
              <span className="hidden md:inline">Kịch Bản Tự Động</span>
            </button>
          </div>

          {/* Right: Close / Return to Home */}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-zinc-300 text-xs font-bold transition active:scale-95 cursor-pointer ml-auto sm:ml-0"
          >
            Quay Lại Trang Chủ
          </button>
        </footer>
      </div>
    </div>
  );
};
