import React from 'react';
import { Minus, X, Terminal } from 'lucide-react';
import { ZeroTraceWordmark } from './Icons';
import { isTauri } from '../utils/tauriBridge';

interface TitleBarProps {
  isConnected?: boolean;
  onOpenLogs?: () => void;
}

const TitleBarComponent: React.FC<TitleBarProps> = ({ isConnected, onOpenLogs }) => {
  const isMac = typeof navigator !== 'undefined' && (
    /Mac/i.test(navigator.userAgent || '') ||
    /Mac/i.test((navigator as unknown as { platform?: string }).platform || '')
  );

  const handleMinimize = async () => {
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('window_minimize');
      } catch (e) {
        console.warn('Failed to minimize via command, falling back to window API', e);
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().minimize();
      }
    }
  };

  const handleClose = async () => {
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('window_close');
      } catch (e) {
        console.warn('Failed to close via command, falling back to window API', e);
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().close();
      }
    }
  };

  if (isMac) {
    return (
      <header className="h-10 w-full relative flex items-center justify-between px-3.5 bg-zt-bg/90 backdrop-blur-md border-b border-zt-border z-50 select-none cursor-default shrink-0">
        {/* Full-width Drag Region Background (z-0) */}
        <div data-tauri-drag-region className="absolute inset-0 z-0" />

        {/* Authentic macOS Traffic Lights (Left, z-10) */}
        <div
          className="relative z-10 flex items-center gap-2 group pointer-events-auto"
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            onClick={e => {
              e.stopPropagation();
              handleClose();
            }}
            onMouseDown={e => e.stopPropagation()}
            className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] flex items-center justify-center cursor-pointer active:brightness-75 transition-all shadow-sm outline-none focus:outline-none"
            title="Close"
            aria-label="Close"
          >
            <X size={7} strokeWidth={3} className="text-[#4C0000] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              handleMinimize();
            }}
            onMouseDown={e => e.stopPropagation()}
            className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] flex items-center justify-center cursor-pointer active:brightness-75 transition-all shadow-sm outline-none focus:outline-none"
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus size={7} strokeWidth={3} className="text-[#4A3200] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </button>
          <div
            className="w-3 h-3 rounded-full bg-[#27C93F]/40 border border-[#1AAB29]/40 flex items-center justify-center cursor-default opacity-50"
            title="Zoom Disabled (Fixed Geometry)"
            aria-label="Zoom Disabled"
          />
        </div>

        {/* Centered App Brand & Status Dot */}
        <div
          data-tauri-drag-region
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none z-0"
        >
          <ZeroTraceWordmark size="sm" />
          <span
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              isConnected
                ? 'bg-zt-success shadow-[0_0_8px_#35C77B]'
                : 'bg-zt-text-faint/30'
            }`}
            title={isConnected ? 'Connected & Protected' : 'Disconnected'}
          />
        </div>

        {/* Right Action (Diagnostics & Logs, z-10) */}
        <div
          className="relative z-10 flex items-center pointer-events-auto"
          onMouseDown={e => e.stopPropagation()}
        >
          {onOpenLogs && (
            <button
              onClick={e => {
                e.stopPropagation();
                onOpenLogs();
              }}
              onMouseDown={e => e.stopPropagation()}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-zt-text-muted hover:text-zt-accent hover:bg-zt-surface-2 transition-colors cursor-pointer outline-none focus:outline-none"
              title="Diagnostics & Logs"
            >
              <Terminal size={12} />
            </button>
          )}
        </div>
      </header>
    );
  }

  // Windows / Linux TitleBar layout
  return (
    <header className="h-10 w-full relative flex items-center justify-between px-3 bg-zt-bg/90 backdrop-blur-md border-b border-zt-border z-50 select-none cursor-default shrink-0">
      {/* Drag Region Background */}
      <div data-tauri-drag-region className="absolute inset-0 z-0" />

      {/* App Brand (Left) */}
      <div
        data-tauri-drag-region
        className="relative z-10 flex items-center gap-2 pointer-events-none"
      >
        <ZeroTraceWordmark size="sm" />
        <span
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            isConnected
              ? 'bg-zt-success shadow-[0_0_8px_#35C77B]'
              : 'bg-zt-text-faint/30'
          }`}
          title={isConnected ? 'Connected & Protected' : 'Disconnected'}
        />
      </div>

      {/* Action Icons + Windows Controls (Right, z-10) */}
      <div
        className="relative z-10 flex items-center gap-1 pointer-events-auto"
        onMouseDown={e => e.stopPropagation()}
      >
        {onOpenLogs && (
          <button
            onClick={e => {
              e.stopPropagation();
              onOpenLogs();
            }}
            onMouseDown={e => e.stopPropagation()}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-zt-text-muted hover:text-zt-accent hover:bg-zt-surface-2 transition-colors cursor-pointer outline-none focus:outline-none"
            title="Diagnostics & Logs"
          >
            <Terminal size={12} />
          </button>
        )}
        <div className="w-px h-3 bg-zt-border mx-0.5" />
        <button
          onClick={e => {
            e.stopPropagation();
            handleMinimize();
          }}
          onMouseDown={e => e.stopPropagation()}
          className="w-6 h-6 flex items-center justify-center rounded text-zt-text-muted hover:text-zt-text hover:bg-zt-surface-2 transition-colors cursor-pointer outline-none focus:outline-none"
          title="Minimize"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            handleClose();
          }}
          onMouseDown={e => e.stopPropagation()}
          className="w-6 h-6 flex items-center justify-center rounded text-zt-text-muted hover:text-white hover:bg-red-500 transition-colors cursor-pointer outline-none focus:outline-none"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>
    </header>
  );
};

export const TitleBar = React.memo(TitleBarComponent);
