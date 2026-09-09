import React from 'react';
import { ArrowDownCircle, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { AppUpdateInfo, openUpdateDownload } from '../utils/updater';

interface UpdateModalProps {
  isOpen: boolean;
  updateInfo: AppUpdateInfo | null;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, updateInfo, onClose }) => {
  if (!isOpen || !updateInfo) return null;

  const handleUpdate = () => {
    openUpdateDownload(updateInfo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl p-5 bg-gradient-to-b from-[#181B26] to-[#0D0F17] border border-white/15 shadow-[0_24px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-blue-600/20 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer outline-none"
        >
          <X size={14} />
        </button>

        {/* Header Badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Sparkles size={12} />
            Update Available
          </span>
          <span className="text-xs font-mono text-white/40">
            v{updateInfo.version}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-lg font-bold text-white tracking-tight mb-1">
          ZeroTrace Desktop v{updateInfo.version}
        </h2>
        <p className="text-xs text-white/50 mb-4">
          Released on {updateInfo.releaseDate}. New performance improvements & features are ready.
        </p>

        {/* Changelog Box */}
        <div className="rounded-2xl bg-black/40 border border-white/10 p-3 mb-5 space-y-2 max-h-40 overflow-y-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block">
            What's New
          </span>
          {updateInfo.changelog.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-white/80">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium transition-colors cursor-pointer outline-none"
          >
            Remind Later
          </button>
          <button
            onClick={handleUpdate}
            className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-[0_4px_16px_rgba(59,130,246,0.4)] flex items-center justify-center gap-1.5 transition-all cursor-pointer outline-none"
          >
            <ArrowDownCircle size={15} />
            <span>Update Now</span>
          </button>
        </div>

      </div>
    </div>
  );
};
