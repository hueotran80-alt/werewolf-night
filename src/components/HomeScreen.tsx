import React, { useEffect, useState } from 'react';
import {
  Moon,
  Plus,
  LogIn,
  Layers,
  BookOpen,
  Sliders,
  Sparkles,
  Shuffle,
} from 'lucide-react';

import { audioService } from '../services/audioService';

interface Props {
  nickname: string;
  onSetNickname: (name: string) => void;
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (code: string, nickname: string) => void;
  onOpenDeckLibrary: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
}

export const HomeScreen: React.FC<Props> = ({
  nickname,
  onSetNickname,
  onCreateRoom,
  onJoinRoom,
  onOpenDeckLibrary,
  onOpenGuide,
  onOpenSettings,
}) => {
  const [nameInput, setNameInput] = useState(nickname || '');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // NHẠC NỀN TRANG CHÍNH
  // ============================================================
  useEffect(() => {
    audioService.playBackgroundMusic();

    return () => {
      audioService.stopBackgroundMusic();
    };
  }, []);

  // ============================================================
  // TẠO TÊN NGẪU NHIÊN
  // ============================================================
  const generateRandomName = () => {
    const prefixes = [
      'Thợ Săn',
      'Tiên Tri',
      'Bảo Hộ',
      'Kỵ Sĩ',
      'Lãng Khách',
      'Phù Thủy',
      'Ẩn Sĩ',
      'Quý Tộc',
    ];

    const names = [
      'Bóng Đêm',
      'Ánh Trăng',
      'Ngân Hà',
      'Huyết Tộc',
      'Rừng Sâu',
      'Gió Lạnh',
      'Bình Minh',
      'Hoàng Hôn',
    ];

    const random = `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${
      names[Math.floor(Math.random() * names.length)]
    }`;

    setNameInput(random);
    onSetNickname(random);
  };

  // ============================================================
  // TẠO PHÒNG
  // ============================================================
  const handleCreate = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    const cleanName = nameInput.trim();

    if (!cleanName) {
      setError('Vui lòng nhập Biệt danh trước khi tạo phòng!');
      return;
    }

    setError(null);

    // Tiếng sói hú khi bắt đầu tạo phòng
    audioService.playWolfHowl();

    onCreateRoom(cleanName);
  };

  // ============================================================
  // VÀO PHÒNG
  // ============================================================
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = nameInput.trim();
    const cleanRoomCode = roomCodeInput.trim().toUpperCase();

    if (!cleanName) {
      setError('Vui lòng nhập Biệt danh trước khi vào phòng!');
      return;
    }

    if (!cleanRoomCode) {
      setError('Vui lòng nhập Mã phòng!');
      return;
    }

    setError(null);

    // Tiếng sói hú khi vào phòng
    audioService.playWolfHowl();

    onJoinRoom(cleanRoomCode, cleanName);
  };

  return (
    <div className="min-h-screen bg-[#05070E] text-zinc-100 flex flex-col justify-between relative overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-cyan-900/15 via-rose-950/10 to-transparent blur-3xl pointer-events-none" />

      {/* ========================================================
          TOP NAVBAR
      ======================================================== */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">

        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-700 via-purple-700 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-rose-950/50">
            <Moon className="w-5 h-5 fill-current text-rose-300" />
          </div>

          <div>
            <h1 className="text-base sm:text-lg font-serif font-black tracking-wider text-white uppercase">
              WEREWOLF: NIGHT OF DECEPTION
            </h1>

            <p className="text-[10px] text-zinc-400 font-mono">
              Diễn xuất không qua mắt nổi Trần Xuân Hùng ĐZ đâu!
            </p>
          </div>

        </div>

        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition"
          title="Cài đặt"
        >
          <Sliders className="w-4 h-4" />
        </button>

      </header>

      {/* ========================================================
          MAIN
      ======================================================== */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center text-center space-y-8 my-auto">

        {/* TITLE */}
        <div className="space-y-3 max-w-2xl">

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-950/60 border border-rose-800/60 text-xs font-semibold text-rose-300 shadow-lg shadow-rose-950/30">

            <Sparkles className="w-3.5 h-3.5 text-rose-400" />

            <span>
              Màn đêm buông xuống • Cănphongf lạnh lẽo
            </span>

          </div>

          <h2 className="text-3xl sm:text-5xl font-serif font-black tracking-tight uppercase text-white drop-shadow-2xl">
            WHO IS DÂN? WHO IS SÓI?
          </h2>

          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Trải nghiệm game Ma Sói thời gian thực với công nghệ
            Authoritative Game Server, bảo mật danh tính và hệ thống
            13 vai trò mở rộng.
          </p>

        </div>

        {/* ========================================================
            NICKNAME
        ======================================================== */}
        <div className="w-full max-w-md p-5 rounded-3xl bg-zinc-950/90 border border-zinc-800/90 shadow-2xl space-y-4 text-left">

          <div>

            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Biệt Danh Của Bạn
            </label>

            <div className="flex gap-2">

              <input
                type="text"
                placeholder="Nhập tên của bạn..."
                maxLength={16}
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  onSetNickname(e.target.value);
                }}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition"
              />

              <button
                type="button"
                onClick={generateRandomName}
                className="p-2.5 rounded-2xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition"
                title="Tạo tên ngẫu nhiên"
              >
                <Shuffle className="w-4 h-4 text-amber-400" />
              </button>

            </div>

          </div>

          {error && (
            <div className="text-xs text-rose-400 font-semibold">
              {error}
            </div>
          )}

          {/* ======================================================
              CREATE / JOIN
          ====================================================== */}
          <div className="pt-2 space-y-3">

            <button
              type="button"
              onClick={handleCreate}
              className="w-full py-3.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 hover:from-rose-600 hover:to-amber-500 text-white shadow-xl shadow-rose-950/50 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>TẠO PHÒNG MỚI (LÀM QUẢN TRÒ)</span>
            </button>

            <div className="relative flex items-center justify-center">

              <div className="border-t border-zinc-800 w-full" />

              <span className="bg-zinc-950 px-3 text-[10px] text-zinc-500 uppercase font-mono tracking-widest absolute">
                Hoặc
              </span>

            </div>

            <form
              onSubmit={handleJoin}
              className="flex gap-2"
            >

              <input
                type="text"
                placeholder="Nhập mã phòng (VD: WOLF-7K29)"
                value={roomCodeInput}
                onChange={(e) =>
                  setRoomCodeInput(e.target.value.toUpperCase())
                }
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono tracking-wider transition uppercase"
              />

              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>VÀO PHÒNG</span>
              </button>

            </form>

          </div>

        </div>

        {/* ========================================================
            FEATURE CARDS
        ======================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl pt-4">

          {/* DECK */}
          <button
            onClick={onOpenDeckLibrary}
            className="p-4 rounded-3xl bg-zinc-950/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-purple-500/50 text-left space-y-2 transition-all group"
          >

            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center group-hover:scale-110 transition">
              <Layers className="w-5 h-5" />
            </div>

            <div>

              <div className="font-bold text-xs text-white font-serif">
                14 THẺ BÀI & VAI TRÒ
              </div>

              <p className="text-[11px] text-zinc-400 mt-0.5">
                Bách khoa toàn thư kỹ năng, cốt truyện và điều kiện thắng
              </p>

            </div>

          </button>

          {/* GUIDE */}
          <button
            onClick={onOpenGuide}
            className="p-4 rounded-3xl bg-zinc-950/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-amber-500/50 text-left space-y-2 transition-all group"
          >

            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center group-hover:scale-110 transition">
              <BookOpen className="w-5 h-5" />
            </div>

            <div>

              <div className="font-bold text-xs text-white font-serif">
                LUẬT CHƠI TÂN THỦ
              </div>

              <p className="text-[11px] text-zinc-400 mt-0.5">
                Quy trình ngày đêm, biểu quyết và chiến thuật sinh tồn
              </p>

            </div>

          </button>

        </div>

      </main>

      {/* ========================================================
          FOOTER
      ======================================================== */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 py-4 text-center text-zinc-500 text-[11px] font-mono border-t border-zinc-900/60">
        Werewolf: Night of Deception • Nơi tự do diễn xuất
      </footer>

    </div>
  );
};