import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Trash2, Copy, Check, ArrowLeft, Download, MessageCircle, RefreshCw } from 'lucide-react';
import { DiagnosticLog } from '../types';
import { api, openExternalUrl } from '../utils/tauriBridge';

interface LogsScreenProps {
  logs: DiagnosticLog[];
  onClear: () => void;
  onBack: () => void;
}

export const LogsScreen: React.FC<LogsScreenProps> = ({ logs: initialLogs, onClear, onBack }) => {
  const [liveLogs, setLiveLogs] = useState<DiagnosticLog[]>(initialLogs);
  const [copied, setCopied] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Sync with prop when it changes
  useEffect(() => {
    if (initialLogs && initialLogs.length > 0) {
      setLiveLogs(initialLogs);
    }
  }, [initialLogs]);

  // Real-time live log polling (every 1000ms while screen is mounted)
  const pollLogs = useCallback(async () => {
    try {
      const fresh = await api.getLogs();
      if (fresh) {
        setLiveLogs(prev => {
          // Micro-optimization: skip state update if log list hasn't changed
          if (
            prev.length === fresh.length &&
            prev[prev.length - 1]?.timestamp === fresh[fresh.length - 1]?.timestamp
          ) {
            return prev;
          }
          return fresh;
        });
      }
    } catch (err) {
      console.error('Failed to poll logs:', err);
    }
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await pollLogs();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  useEffect(() => {
    pollLogs();
    const interval = setInterval(pollLogs, 1000);
    return () => clearInterval(interval);
  }, [pollLogs]);

  // Auto-scroll to latest log entry
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLogs.length]);

  const filteredLogs = liveLogs.filter(l => filterLevel === 'ALL' || l.level === filterLevel);

  const handleCopy = () => {
    const text = liveLogs.map(l => `[${l.timestamp}] [${l.level}] [${l.tag}]: ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    onClear();
    setLiveLogs([]);
  };

  const handleSendToSupport = async () => {
    try {
      setIsSending(true);
      const report = await api.exportDiagnosticReport();
      await navigator.clipboard.writeText(report);
      setToastMsg('Report copied! Opening WhatsApp support…');
      setTimeout(() => {
        openExternalUrl('https://wa.me/94788385465?text=Hello%20ZeroTrace%20Support%2C%20here%20is%20my%20diagnostic%20report%20(pasting%20below)...');
      }, 500);
      setTimeout(() => setToastMsg(null), 3500);
    } catch (e) {
      console.error('Failed to export diagnostic report:', e);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const report = await api.exportDiagnosticReport();
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ZeroTrace-Diagnostics-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMsg('Saved diagnostic log file!');
      setTimeout(() => setToastMsg(null), 2500);
    } catch (e) {
      console.error('Failed to download report:', e);
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-zt-danger bg-zt-danger-soft border-zt-danger/20';
      case 'WARN': return 'text-zt-warn bg-zt-warn-soft border-zt-warn/20';
      case 'DEBUG': return 'text-zt-text-faint bg-zt-surface border-zt-border';
      default: return 'text-zt-accent bg-zt-accent-soft border-zt-accent/20';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-w-sm mx-auto w-full overflow-hidden">
      {/* 1. Top Header Row: Back button & Title with Live Badge */}
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-zt-border shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full flex items-center justify-center text-zt-text-muted hover:text-zt-text hover:bg-zt-surface-2 transition-colors shrink-0 cursor-pointer"
          title="Back to Previous Screen"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-zt-text flex items-center gap-1.5 truncate">
              <Terminal size={16} className="text-zt-accent shrink-0" />
              <span>Diagnostics & Core Logs</span>
            </h1>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </div>
          </div>
          <p className="text-[10px] text-zt-text-muted truncate">Real-time engine events & connection diagnostics</p>
        </div>
      </div>

      {/* 2. Compact Action Toolbar */}
      <div className="space-y-2 my-2.5 shrink-0">
        {/* Row 1: Filter, Refresh, Copy, Clear */}
        <div className="flex items-center justify-between gap-1.5">
          <select
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value)}
            className="flex-1 min-w-0 rounded-xl bg-zt-surface border border-zt-border px-2 py-1.5 text-xs font-mono text-zt-text focus:outline-none cursor-pointer truncate"
          >
            <option value="ALL">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="DEBUG">DEBUG</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zt-surface border border-zt-border hover:border-zt-border-strong text-xs font-semibold text-zt-text transition-colors shrink-0 cursor-pointer active:scale-95"
            title="Refresh logs immediately"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-zt-accent' : ''} />
            <span>Fetch</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zt-surface border border-zt-border hover:border-zt-border-strong text-xs font-semibold text-zt-text transition-colors shrink-0 cursor-pointer active:scale-95"
          >
            {copied ? <Check size={12} className="text-zt-success" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zt-surface border border-zt-border hover:text-zt-danger hover:border-zt-danger/40 text-xs font-semibold text-zt-text-muted transition-colors shrink-0 cursor-pointer active:scale-95"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        </div>

        {/* Row 2: Send to Support & Download Report */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSendToSupport}
            disabled={isSending}
            className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 outline-none"
          >
            <MessageCircle size={14} />
            <span>Send to WhatsApp Support</span>
          </button>

          <button
            onClick={handleDownloadReport}
            className="py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer active:scale-95 outline-none"
            title="Export full diagnostic report as .txt file"
          >
            <Download size={13} />
            <span>Save .txt</span>
          </button>
        </div>

        {/* Toast notification */}
        {toastMsg && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs flex items-center gap-1.5 animate-fade-in font-medium">
            <Check size={13} />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>

      {/* 3. Terminal Viewport */}
      <div className="flex-1 p-3 rounded-2xl bg-zt-bg-elevated border border-zt-border font-mono text-[10.5px] overflow-y-auto space-y-1.5 select-text shadow-inner">
        {filteredLogs.length > 0 ? (
          <>
            {filteredLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-1.5 leading-relaxed">
                <span className="text-zt-text-faint shrink-0 text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`px-1 rounded text-[8.5px] font-bold border uppercase shrink-0 ${getLevelBadge(log.level)}`}>
                  {log.level}
                </span>
                <span className="text-zt-accent font-semibold shrink-0 text-[10px]">
                  [{log.tag}]
                </span>
                <span className="text-zt-text break-words">
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-zt-text-faint text-xs">
            <span>No log entries recorded.</span>
          </div>
        )}
      </div>
    </div>
  );
};

