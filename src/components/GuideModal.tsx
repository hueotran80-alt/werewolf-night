import React, { useState } from 'react';
import { BEGINNER_GUIDE } from '../data/rulesData';
import { X, BookOpen, ChevronRight, Lightbulb, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeSectionId, setActiveSectionId] = useState<string>(BEGINNER_GUIDE[0].id);

  if (!isOpen) return null;

  const currentSection = BEGINNER_GUIDE.find((s) => s.id === activeSectionId) || BEGINNER_GUIDE[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl h-[85vh] bg-[#0B0F19] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white font-serif tracking-wide">
                HƯỚNG DẪN TÂN THỦ & LUẬT CHƠI
              </h3>
              <p className="text-xs text-zinc-400">
                Hiểu trọn vẹn quy trình ngày & đêm, bỏ phiếu và chiến thuật sinh tồn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Split: Navigation Sidebar & Content Viewer */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Left Nav */}
          <div className="md:col-span-4 border-r border-zinc-800 overflow-y-auto p-4 space-y-1.5 bg-zinc-950/30">
            {BEGINNER_GUIDE.map((section) => {
              const isSelected = activeSectionId === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-zinc-800/90 border-amber-500/60 shadow-md text-amber-300 font-bold'
                      : 'bg-zinc-900/30 border-zinc-800/60 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-xs">{section.title}</span>
                  <ChevronRight className="w-4 h-4 opacity-70" />
                </button>
              );
            })}
          </div>

          {/* Right Content */}
          <div className="md:col-span-8 overflow-y-auto p-6 space-y-5 bg-zinc-950/50">
            <div>
              <h2 className="text-xl font-bold text-white font-serif tracking-wide flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span>{currentSection.title}</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1 italic">{currentSection.summary}</p>
            </div>

            {/* Paragraphs */}
            <div className="space-y-3">
              {currentSection.content.map((paragraph, idx) => (
                <p key={idx} className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Strategy Tips */}
            {currentSection.tips && currentSection.tips.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-2">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  <span>Mẹo Chiến Thuật Cao Cấp:</span>
                </div>
                <ul className="space-y-1 text-xs text-amber-200/90 list-disc list-inside">
                  {currentSection.tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
