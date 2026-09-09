import React, { useState, useEffect } from 'react';
import { ArrowDownCircle, Sparkles, X, CheckCircle2, AlertCircle, Check } from 'lucide-react';
import { AppUpdateInfo, openUpdateDownload } from '../utils/updater';
import { isTauri } from '../utils/tauriBridge';

interface UpdateModalProps {
  isOpen: boolean;
  updateInfo: AppUpdateInfo | null;
  onClose: () => void;
}

type UpdateStage = 'idle' | 'downloading' | 'verifying' | 'installing' | 'restarting';

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, updateInfo, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStage, setDownloadStage] = useState<UpdateStage>('idle');
  const [stageDetail, setStageDetail] = useState<string>('');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    if (isTauri()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<{ percent: number; stage: string; detail: string }>(
          'update-download-progress',
          event => {
            const { percent, stage, detail } = event.payload;
            if (typeof percent === 'number') {
              setDownloadProgress(Math.max(0, Math.min(100, percent)));
            }
            if (stage) setDownloadStage(stage as UpdateStage);
            if (detail) setStageDetail(detail);
          }
        ).then(fn => {
          unlisten = fn;
        }).catch(err => {
          console.warn('[Updater] Could not bind progress event:', err);
        });
      });
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  if (!isOpen || !updateInfo) return null;

  const handleUpdate = async () => {
    setIsDownloading(true);
    setErrorText(null);
    setDownloadProgress(2);
    setDownloadStage('downloading');
    setStageDetail('Connecting to update server…');

    const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent || '');
    const targetUrl = isMac ? updateInfo.macos.url : updateInfo.windows.url;

    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('download_and_install_update', { url: targetUrl });
      } catch (err: unknown) {
        console.error('In-app update failed:', err);
        setErrorText(typeof err === 'string' ? err : 'Download failed. Please check your connection.');
        setIsDownloading(false);
        setDownloadStage('idle');
      }
    } else {
      // Fallback for browser / preview mode with simulated smooth progress
      let current = 2;
      const interval = setInterval(() => {
        current += 12;
        if (current >= 100) {
          clearInterval(interval);
          setDownloadProgress(100);
          setDownloadStage('restarting');
          setTimeout(() => {
            openUpdateDownload(updateInfo);
            onClose();
          }, 800);
        } else {
          setDownloadProgress(current);
        }
      }, 200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl p-5 bg-gradient-to-b from-[#181B26] to-[#0D0F17] border border-white/15 shadow-[0_24px_50px_rgba(0,0,0,0.85)] relative overflow-hidden animate-modal-enter">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-blue-600/25 via-cyan-500/10 to-transparent pointer-events-none" />

        {/* Close Button (disabled while downloading) */}
        {!isDownloading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer outline-none active:scale-95"
          >
            <X size={14} />
          </button>
        )}

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
          Released on {updateInfo.releaseDate}. Seamless in-place update.
        </p>

        {/* Changelog Box (collapses down slightly when downloading) */}
        <div className={`rounded-2xl bg-black/40 border border-white/10 p-3 mb-5 space-y-2 overflow-y-auto transition-all duration-300 ${isDownloading ? 'max-h-24' : 'max-h-40'}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block">
            What's New
          </span>
          {updateInfo.changelog.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-white/80">
              <CheckCircle2 size={13} className="text-cyan-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{item}</span>
            </div>
          ))}
        </div>

        {/* Error Feedback */}
        {errorText && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-xs text-red-400 animate-fade-in">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span className="leading-tight">{errorText}</span>
          </div>
        )}

        {/* Actions / Smooth Progress Section */}
        {!isDownloading ? (
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium transition-colors cursor-pointer outline-none active:scale-95"
            >
              Remind Later
            </button>
            <button
              onClick={handleUpdate}
              className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:brightness-110 text-white text-xs font-semibold shadow-[0_4px_20px_rgba(59,130,246,0.45)] flex items-center justify-center gap-1.5 transition-all cursor-pointer outline-none active:scale-95"
            >
              <ArrowDownCircle size={15} />
              <span>Update Now</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 space-y-2.5 animate-fade-in">
            {/* Header row: Stage indicator + Percentage counter */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {downloadStage === 'restarting' ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex items-center justify-center text-black">
                    <Check size={9} strokeWidth={3} />
                  </span>
                ) : (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                  </span>
                )}
                <span className="font-medium text-white/90">
                  {downloadStage === 'downloading' && 'Downloading update package…'}
                  {downloadStage === 'verifying' && 'Verifying package integrity…'}
                  {downloadStage === 'installing' && 'Installing update…'}
                  {downloadStage === 'restarting' && 'Restarting ZeroTrace…'}
                  {downloadStage === 'idle' && 'Preparing update…'}
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                {Math.round(downloadProgress)}%
              </span>
            </div>

            {/* Outer Progress Track */}
            <div className="h-2.5 w-full rounded-full bg-black/60 border border-white/10 p-0.5 relative overflow-hidden shadow-inner">
              {/* Smooth Animated Fill Bar */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 transition-all duration-300 ease-out relative shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                style={{ width: `${Math.max(4, Math.min(100, downloadProgress))}%` }}
              >
                {/* Moving Light Beam Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-progress-shimmer" />
              </div>
            </div>

            {/* Footer detail */}
            <div className="flex items-center justify-between text-[11px] text-white/40 font-mono">
              <span className="truncate max-w-[200px]">{stageDetail || 'Direct background update'}</span>
              <span>v{updateInfo.version}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

