import React, { useState } from 'react';
import { Settings, Shield, Globe, Terminal, ChevronRight, Check, RefreshCw } from 'lucide-react';
import { AppSettings, DpiBypassMode } from '../types';
import { checkForAppUpdate, AppUpdateInfo, CURRENT_APP_VERSION } from '../utils/updater';

interface SettingsScreenProps {
  settings: AppSettings;
  onSave: (updated: AppSettings) => void;
  onOpenLogs?: () => void;
  onShowUpdateModal?: (info: AppUpdateInfo) => void;
}

/**
 * Minimalist Apple-Style Grouped Settings Screen
 * - Clean iOS-style grouped sections with subtle dividers
 * - Streamlined pickers instead of giant vertical card walls
 * - Calm, spacious rhythm and clear visual hierarchy
 */
export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onSave,
  onOpenLogs,
  onShowUpdateModal,
}) => {
  const [current, setCurrent] = useState<AppSettings>(settings);
  const [savedMessage, setSavedMessage] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateMsg(null);
    try {
      const res = await checkForAppUpdate();
      if (res.hasUpdate && res.update) {
        onShowUpdateModal?.(res.update);
      } else {
        setUpdateMsg(`You're on latest (v${CURRENT_APP_VERSION})`);
        setTimeout(() => setUpdateMsg(null), 3500);
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const dnsOptions = [
    { id: '94.140.14.14', name: 'AdGuard Ad-Blocker (Ad-Block)', tag: 'Recommended' },
    { id: '1.1.1.1', name: 'Cloudflare Speed (1.1.1.1)', tag: 'Ultra-Fast' },
    { id: '1.1.1.2', name: 'Cloudflare Security', tag: 'Malware Block' },
    { id: '8.8.8.8', name: 'Google Public DNS', tag: 'Global' },
    { id: '9.9.9.9', name: 'Quad9 Threat Defense', tag: 'Secure' },
  ];

  const dpiOptions: { id: DpiBypassMode; label: string }[] = [
    { id: 'SMART_FRAGMENT', label: 'Smart TLS Fragment (Recommended)' },
    { id: 'DEEP_STEALTH', label: 'Deep Stealth Engine' },
    { id: 'OFF', label: 'Disabled (Direct)' },
    { id: 'CUSTOM', label: 'Custom Fragment' },
  ];

  const utlsOptions = ['chrome', 'firefox', 'safari', 'ios', 'android', 'edge'];

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...current, [key]: value };
    setCurrent(updated);
    onSave(updated);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 1200);
  };

  return (
    <div className="flex-1 flex flex-col px-4 pt-3 pb-4 max-w-sm mx-auto w-full overflow-y-auto space-y-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 shrink-0">
        <h1 className="text-base font-bold text-white tracking-tight">Settings</h1>
        {savedMessage && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium animate-fade-in">
            <Check size={13} /> Saved
          </span>
        )}
      </div>

      {/* Group 1: DNS & Anti-Censorship */}
      <div>
        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider px-1 mb-1.5 block">
          Network & DNS
        </span>
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden divide-y divide-white/5 text-xs">
          {/* DNS Resolver */}
          <div className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Globe size={15} className="text-blue-400 shrink-0" />
              <span className="font-medium text-white/90">DNS Resolver</span>
            </div>
            <select
              value={current.primaryDns}
              onChange={e => updateSetting('primaryDns', e.target.value)}
              className="rounded-xl bg-white/10 border border-white/10 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500/50 max-w-[170px] truncate cursor-pointer"
            >
              {dnsOptions.map(dns => (
                <option key={dns.id} value={dns.id} className="bg-zinc-900 text-white">
                  {dns.name}
                </option>
              ))}
            </select>
          </div>

          {/* DPI Bypass Mode */}
          <div className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Shield size={15} className="text-blue-400 shrink-0" />
              <span className="font-medium text-white/90">DPI Bypass</span>
            </div>
            <select
              value={current.dpiBypassMode}
              onChange={e => updateSetting('dpiBypassMode', e.target.value as DpiBypassMode)}
              className="rounded-xl bg-white/10 border border-white/10 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500/50 max-w-[170px] truncate cursor-pointer"
            >
              {dpiOptions.map(dpi => (
                <option key={dpi.id} value={dpi.id} className="bg-zinc-900 text-white">
                  {dpi.label}
                </option>
              ))}
            </select>
          </div>

          {/* uTLS Fingerprint */}
          <div className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Settings size={15} className="text-blue-400 shrink-0" />
              <span className="font-medium text-white/90">uTLS Fingerprint</span>
            </div>
            <select
              value={current.utlsFingerprint}
              onChange={e => updateSetting('utlsFingerprint', e.target.value)}
              className="rounded-xl bg-white/10 border border-white/10 px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-blue-500/50 uppercase cursor-pointer"
            >
              {utlsOptions.map(fp => (
                <option key={fp} value={fp} className="bg-zinc-900 text-white">
                  {fp.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Group 2: Routing & Security Toggles */}
      <div>
        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider px-1 mb-1.5 block">
          Tunnel & Routing
        </span>
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden divide-y divide-white/5 text-xs">
          {/* Bypass LAN */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-medium text-white/90">Bypass Local LAN</span>
              <span className="text-[11px] text-white/40">Direct routing for 192.168.x.x subnets</span>
            </div>
            <button
              onClick={() => updateSetting('bypassLan', !current.bypassLan)}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                current.bypassLan ? 'bg-blue-600' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${
                  current.bypassLan ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Kill Switch */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-medium text-white/90">Kill Switch</span>
              <span className="text-[11px] text-white/40">Block traffic if tunnel disconnects</span>
            </div>
            <button
              onClick={() => updateSetting('killSwitch', !current.killSwitch)}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                current.killSwitch ? 'bg-blue-600' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${
                  current.killSwitch ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Mux Multiplexing */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-medium text-white/90">Mux Multiplexing</span>
              <span className="text-[11px] text-white/40">Consolidate TCP streams</span>
            </div>
            <button
              onClick={() => updateSetting('muxEnabled', !current.muxEnabled)}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                current.muxEnabled ? 'bg-blue-600' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${
                  current.muxEnabled ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Group 3: Carrier Bug Host SNI Tweak */}
      <div>
        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider px-1 mb-1.5 block">
          Carrier SNI Override
        </span>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-xs">
          <input
            type="text"
            value={current.sriLankaSniTweak}
            onChange={e => updateSetting('sriLankaSniTweak', e.target.value)}
            placeholder="e.g. slt.lk, zero.dialog.lk (optional)"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Group 4: About & Software Updates */}
      <div>
        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider px-1 mb-1.5 block">
          About & Updates
        </span>
        <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/5 overflow-hidden shadow-sm">
          {/* Version Details Row */}
          <div className="px-3.5 py-3 flex items-center justify-between text-xs">
            <div className="flex flex-col">
              <span className="font-semibold text-white/95">ZeroTrace Desktop</span>
              <span className="text-[11px] text-white/40 mt-0.5">Cross-Platform Hybrid Engine</span>
            </div>
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
              v{CURRENT_APP_VERSION}
            </span>
          </div>

          {/* Software Update Action Row */}
          <button
            onClick={handleManualCheckUpdate}
            disabled={isCheckingUpdate}
            className="w-full px-3.5 py-3 flex items-center justify-between text-xs hover:bg-white/5 active:bg-white/8 transition-all cursor-pointer outline-none group text-left disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                <RefreshCw
                  size={14}
                  className={isCheckingUpdate ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 transition-transform duration-500 text-blue-400'}
                />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-white/90 group-hover:text-white transition-colors">
                  Software Update
                </span>
                <span className="text-[11px] text-white/40 mt-0.5">
                  {updateMsg || 'Check for new releases & patches'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-white/30 group-hover:text-white/70 transition-colors">
              {isCheckingUpdate && <span className="text-[11px] text-blue-400 font-medium">Checking…</span>}
              <ChevronRight size={14} />
            </div>
          </button>
        </div>
      </div>

      {/* Group 5: Diagnostics & Logs */}
      {onOpenLogs && (
        <div
          onClick={onOpenLogs}
          className="rounded-2xl bg-white/5 hover:bg-white/8 border border-white/10 p-3 flex items-center justify-between cursor-pointer transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <Terminal size={15} className="text-blue-400" />
            <span className="text-xs font-medium text-white/90">System Diagnostics & Logs</span>
          </div>
          <ChevronRight size={14} className="text-white/30 group-hover:text-white/70 transition-colors" />
        </div>
      )}
    </div>
  );
};
