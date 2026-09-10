import React, { useState, useEffect } from 'react';
import { ArrowDownCircle, Sparkles, X, AlertCircle, Check } from 'lucide-react';
import { AppUpdateInfo, openUpdateDownload } from '../utils/updater';
import { isTauri } from '../utils/tauriBridge';
import { AppleIcon, Windows11Icon } from './Icons';

interface UpdateModalProps {
  isOpen: boolean;
  updateInfo: AppUpdateInfo | null;
  onClose: () => void;
  isLightMode?: boolean;
}

type UpdateStage = 'idle' | 'downloading' | 'verifying' | 'installing' | 'restarting';

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, updateInfo, onClose, isLightMode }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStage, setDownloadStage] = useState<UpdateStage>('idle');
  const [stageDetail, setStageDetail] = useState<string>('');
  const [errorText, setErrorText] = useState<string | null>(null);

  const isLight = isLightMode ?? (typeof document !== 'undefined' && (
    document.documentElement.classList.contains('theme-light') ||
    Boolean(document.querySelector('.theme-light'))
  ));

  const isMac = typeof navigator !== 'undefined' && (
    /Mac/i.test(navigator.userAgent || '') ||
    /Mac/i.test((navigator as unknown as { platform?: string }).platform || '')
  );

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

  const [mounted, setMounted] = useState(isOpen && !!updateInfo);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen && updateInfo) {
      setMounted(true);
      setIsClosing(false);
    } else if (mounted) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setIsClosing(false);
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen, updateInfo, mounted]);

  // ESC key dismissal
  useEffect(() => {
    if (!mounted || isClosing || isDownloading) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, isClosing, isDownloading, onClose]);

  if (!mounted || !updateInfo) return null;

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
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 cursor-pointer transition-colors duration-300 ${
        isLight ? 'bg-slate-900/25 backdrop-blur-md' : 'bg-black/70 backdrop-blur-md'
      } ${
        isClosing ? 'animate-backdrop-exit' : 'animate-backdrop-enter'
      }`}
      onClick={() => {
        if (!isDownloading) onClose();
      }}
    >
      <div
        className={`w-full max-w-[328px] rounded-3xl p-5 relative overflow-hidden text-center cursor-default transition-all duration-300 ${
          isLight
            ? 'bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-[0_20px_45px_-10px_rgba(15,23,42,0.14),0_0_0_1px_rgba(0,0,0,0.04)] text-slate-900'
            : 'bg-zt-surface border border-zt-border shadow-[0_24px_50px_rgba(0,0,0,0.5)] text-zt-text'
        } ${
          isClosing ? 'animate-modal-exit' : 'animate-modal-enter'
        }`}
        onClick={e => e.stopPropagation()}
      >
        
        {/* Close Button (disabled while downloading) */}
        {!isDownloading && (
          <button
            onClick={onClose}
            className={`absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer outline-none active:scale-95 ${
              isLight
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-zt-text-muted hover:text-zt-text hover:bg-zt-surface-2'
            }`}
          >
            <X size={14} />
          </button>
        )}

        {/* Header Icon */}
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-2.5 shadow-sm transition-colors ${
            isLight
              ? 'bg-indigo-50 border border-indigo-200/60 text-indigo-600'
              : 'bg-zt-accent/10 border border-zt-accent/20 text-zt-accent'
          }`}
        >
          <Sparkles size={20} />
        </div>

        {/* Title & Version */}
        <h2 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-zt-text'}`}>
          Update Available
        </h2>
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono mt-1 mb-2 transition-colors ${
            isLight
              ? 'bg-slate-100/90 border border-slate-200/80 text-slate-600'
              : 'bg-zt-surface-2 border border-zt-border text-zt-text-muted'
          }`}
        >
          {isMac ? (
            <AppleIcon size={11} className={`shrink-0 ${isLight ? 'text-slate-800' : 'text-zt-text'}`} />
          ) : (
            <Windows11Icon size={10} className="text-[#0078D4] shrink-0" />
          )}
          <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-zt-text'}`}>v{updateInfo.version}</span>
          <span>•</span>
          <span>{isMac ? 'macOS' : 'Windows 11'}</span>
        </div>
        <p className={`text-xs mb-3 leading-relaxed ${isLight ? 'text-slate-500' : 'text-zt-text-muted'}`}>
          A new version is ready with performance and security enhancements.
        </p>

        {/* Changelog Box */}
        {updateInfo.changelog && updateInfo.changelog.length > 0 && (
          <div
            className={`mb-4 p-3 rounded-2xl text-left transition-colors ${
              isLight
                ? 'bg-slate-50/90 border border-slate-200/80'
                : 'bg-zt-surface-2 border border-zt-border'
            }`}
          >
            <div className={`text-[10px] font-semibold uppercase tracking-wider mb-2 px-0.5 ${
              isLight ? 'text-slate-400' : 'text-zt-text-muted'
            }`}>
              Highlights
            </div>
            <ul className={`space-y-1.5 text-xs max-h-32 overflow-y-auto pr-1 ${
              isLight ? 'text-slate-700' : 'text-zt-text'
            }`}>
              {updateInfo.changelog.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    isLight ? 'bg-indigo-600' : 'bg-zt-accent'
                  }`} />
                  <span className={`text-xs leading-relaxed ${isLight ? 'text-slate-700' : 'text-zt-text/90'}`}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error Feedback */}
        {errorText && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-xs text-red-500 text-left animate-fade-in">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span className="leading-tight">{errorText}</span>
          </div>
        )}

        {/* Actions / Progress Section */}
        {!isDownloading ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer outline-none active:scale-95 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700'
                  : 'bg-zt-surface-2 hover:bg-zt-surface border border-zt-border text-zt-text'
              }`}
            >
              Later
            </button>
            <button
              onClick={handleUpdate}
              className={`flex-1 py-2.5 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer outline-none active:scale-95 ${
                isLight
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/25'
                  : 'bg-zt-accent hover:bg-zt-accent-hover shadow-md shadow-zt-accent/25'
              }`}
            >
              <ArrowDownCircle size={14} />
              <span>Update Now</span>
            </button>
          </div>
        ) : (
          <div className={`rounded-2xl border p-3.5 space-y-2.5 animate-fade-in text-left transition-colors ${
            isLight
              ? 'bg-slate-50 border-slate-200'
              : 'bg-zt-surface-2 border-zt-border'
          }`}>
            {/* Header row: Stage indicator + Percentage counter */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {downloadStage === 'restarting' ? (
                  <Check size={14} className="text-emerald-500" />
                ) : (
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isLight ? 'bg-indigo-600' : 'bg-zt-accent'
                    }`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      isLight ? 'bg-indigo-600' : 'bg-zt-accent'
                    }`} />
                  </span>
                )}
                <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-zt-text'}`}>
                  {downloadStage === 'downloading' && 'Downloading update…'}
                  {downloadStage === 'verifying' && 'Verifying package…'}
                  {downloadStage === 'installing' && 'Installing update…'}
                  {downloadStage === 'restarting' && 'Restarting ZeroTrace…'}
                  {downloadStage === 'idle' && 'Preparing update…'}
                </span>
              </div>
              <span className={`font-mono text-xs font-bold ${isLight ? 'text-indigo-600' : 'text-zt-accent'}`}>
                {Math.round(downloadProgress)}%
              </span>
            </div>

            {/* Clean Progress Track */}
            <div className={`h-2 w-full rounded-full overflow-hidden p-0.5 shadow-inner ${
              isLight ? 'bg-slate-200/80 border border-slate-300/40' : 'bg-zt-surface border border-zt-border'
            }`}>
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out relative ${
                  isLight ? 'bg-indigo-600' : 'bg-zt-accent'
                }`}
                style={{ width: `${Math.max(4, Math.min(100, downloadProgress))}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-progress-shimmer" />
              </div>
            </div>

            {/* Footer detail */}
            <div className={`flex items-center justify-between text-[11px] font-mono ${
              isLight ? 'text-slate-400' : 'text-zt-text-muted'
            }`}>
              <span className="truncate max-w-[200px]">{stageDetail || 'Direct background update'}</span>
              <span>v{updateInfo.version}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

