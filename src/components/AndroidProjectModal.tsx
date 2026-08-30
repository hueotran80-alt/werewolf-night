import React, { useState } from 'react';
import { ANDROID_PROJECT_FILES, AndroidCodeFile } from '../data/androidProjectFiles';
import { safeCopyToClipboard } from '../lib/storage';
import { X, Smartphone, Copy, Check, Terminal, FileCode, FolderGit2, Cpu } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidProjectModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<AndroidCodeFile>(ANDROID_PROJECT_FILES[1]); // build.gradle.kts
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await safeCopyToClipboard(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl h-[88vh] bg-[#0B0F19] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Smartphone className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white font-serif tracking-wide">
                ANDROID NATIVE PROJECT ARCHITECTURE
              </h3>
              <p className="text-xs text-zinc-400">
                Mã nguồn chuẩn Android Kotlin, Jetpack Compose, OkHttp WSS & Clean Architecture
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

        {/* Info Banner */}
        <div className="p-3.5 bg-emerald-950/20 border-b border-emerald-900/30 flex items-center justify-between px-5">
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>Build APK Thật:</strong> Mở Android Studio ➜ Import Project ➜ Chạy lệnh{' '}
              <code className="px-1.5 py-0.5 rounded bg-zinc-900 font-mono text-emerald-400">
                ./gradlew assembleRelease
              </code>
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white flex items-center gap-1.5 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép!' : 'Sao chép file này'}</span>
          </button>
        </div>

        {/* Content Split: File Tree & Code Preview */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* File Tree */}
          <div className="md:col-span-4 border-r border-zinc-800 overflow-y-auto p-4 space-y-2 bg-zinc-950/40">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FolderGit2 className="w-4 h-4 text-emerald-400" />
              <span>Cấu trúc Project:</span>
            </div>

            {ANDROID_PROJECT_FILES.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-zinc-800 border-emerald-500/60 text-white shadow-md'
                      : 'bg-zinc-900/30 border-zinc-800/60 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  <FileCode className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-mono text-xs truncate font-semibold">{file.path}</div>
                    <div className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                      {file.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Code Viewer */}
          <div className="md:col-span-8 overflow-y-auto p-5 bg-[#070A11]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-emerald-400 font-bold">
                {selectedFile.path}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                {selectedFile.category}
              </span>
            </div>
            <pre className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed">
              <code>{selectedFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
