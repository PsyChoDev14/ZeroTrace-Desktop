import React, { useState } from 'react';
import { Settings, Shield, Globe, Terminal, ChevronRight, Check, RefreshCw, ExternalLink, Sun, Moon, Monitor } from 'lucide-react';
import { AppSettings, DpiBypassMode } from '../types';
import { checkForAppUpdate, AppUpdateInfo, CURRENT_APP_VERSION } from '../utils/updater';
import { openExternalUrl } from '../utils/tauriBridge';
import { AppleIcon, Windows11Icon } from '../components/Icons';

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
const WhatsAppIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

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

  const isMac = typeof navigator !== 'undefined' && (
    /Mac/i.test(navigator.userAgent || '') ||
    /Mac/i.test((navigator as unknown as { platform?: string }).platform || '')
  );

  const handleContactWhatsApp = () => {
    openExternalUrl('https://wa.me/94788385465');
  };

  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateMsg(null);
    try {
      const res = await checkForAppUpdate();
      if (res.hasUpdate && res.update) {
        onShowUpdateModal?.(res.update);
      } else {
        setUpdateMsg(`You're up to date - v${CURRENT_APP_VERSION} is the latest version.`);
      }
    } catch {
      setUpdateMsg('Could not check for updates. Please check your internet connection.');
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
    { id: 'OFF', label: 'Disabled (Direct - Fastest)' },
    { id: 'SMART_FRAGMENT', label: 'Smart TLS Fragment (Anti-Censorship)' },
    { id: 'DEEP_STEALTH', label: 'Deep Stealth Engine' },
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
        <h1 className="text-base font-bold text-zt-text tracking-tight">Settings</h1>
        {savedMessage && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium animate-fade-in">
            <Check size={13} /> Saved
          </span>
        )}
      </div>

      {/* Group 0: Appearance */}
      <div>
        <span className="text-[11px] font-semibold text-zt-text-muted uppercase tracking-wider px-1 mb-1.5 block">
          Appearance
        </span>
        <div className="rounded-2xl bg-zt-surface border border-zt-border p-3 flex items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zt-surface-2 border border-zt-border flex items-center justify-center shrink-0">
              {current.theme === 'light' ? (
                <Sun size={15} className="text-amber-500 transition-transform duration-300 rotate-90" />
              ) : current.theme === 'system' ? (
                <Monitor size={15} className="text-blue-400 transition-transform duration-300" />
              ) : (
                <Moon size={15} className="text-indigo-400 transition-transform duration-300 -rotate-12" />
              )}
            </div>
            <span className="font-medium text-zt-text text-xs">Interface Theme</span>
          </div>

          {/* Clean Minimalist Segmented Control */}
          <div className="relative flex items-center p-0.5 rounded-xl bg-zt-surface-2 border border-zt-border w-[172px]">
            {/* Smooth Sliding Pill Indicator */}
            <div
              className="absolute top-0.5 bottom-0.5 rounded-lg bg-zt-accent shadow-sm transition-all duration-300 ease-out pointer-events-none"
              style={{
                width: 'calc((100% - 4px) / 3)',
                left:
                  (current.theme || 'dark') === 'dark'
                    ? '2px'
                    : current.theme === 'light'
                    ? 'calc(2px + (100% - 4px) / 3)'
                    : 'calc(2px + ((100% - 4px) / 3) * 2)',
              }}
            />
            {(['dark', 'light', 'system'] as const).map(mode => {
              const selected = (current.theme || 'dark') === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateSetting('theme', mode)}
                  className={`relative z-10 flex-1 py-1.5 text-[11.5px] tracking-tight transition-colors duration-200 cursor-pointer text-center outline-none ${
                    selected ? 'text-white font-semibold' : 'text-zt-text-muted hover:text-zt-text font-medium'
                  }`}
                >
                  {mode === 'system' ? 'Auto' : mode === 'dark' ? 'Dark' : 'Light'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Group 1: DNS & Anti-Censorship */}
      <div>
        <span className="text-[11px] font-semibold text-zt-text-muted uppercase tracking-wider px-1 mb-1.5 block">
          Network & DNS
        </span>
        <div className="rounded-2xl bg-zt-surface border border-zt-border overflow-hidden divide-y divide-zt-border text-xs">
          {/* DNS Resolver */}
          <div className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Globe size={15} className="text-blue-400 shrink-0" />
              <span className="font-medium text-zt-text">DNS Resolver</span>
            </div>
            <select
              value={current.primaryDns}
              onChange={e => updateSetting('primaryDns', e.target.value)}
              className="rounded-xl bg-zt-surface-2 border border-zt-border px-2.5 py-1 text-xs text-zt-text focus:outline-none focus:border-zt-accent max-w-[170px] truncate cursor-pointer"
            >
              {dnsOptions.map(dns => (
                <option key={dns.id} value={dns.id} className="bg-zt-surface text-zt-text">
                  {dns.name}
                </option>
              ))}
            </select>
          </div>

          {/* DPI Bypass Mode */}
          <div className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Shield size={15} className="text-blue-400 shrink-0" />
              <span className="font-medium text-zt-text">DPI Bypass</span>
            </div>
            <select
              value={current.dpiBypassMode}
              onChange={e => updateSetting('dpiBypassMode', e.target.value as DpiBypassMode)}
              className="rounded-xl bg-zt-surface-2 border border-zt-border px-2.5 py-1 text-xs text-zt-text focus:outline-none focus:border-zt-accent max-w-[170px] truncate cursor-pointer"
            >
              {dpiOptions.map(dpi => (
                <option key={dpi.id} value={dpi.id} className="bg-zt-surface text-zt-text">
                  {dpi.label}
                </option>
              ))}
            </select>
          </div>

          {/* uTLS Fingerprint */}
          <div className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Settings size={15} className="text-blue-400 shrink-0" />
              <span className="font-medium text-zt-text">uTLS Fingerprint</span>
            </div>
            <select
              value={current.utlsFingerprint}
              onChange={e => updateSetting('utlsFingerprint', e.target.value)}
              className="rounded-xl bg-zt-surface-2 border border-zt-border px-2.5 py-1 text-xs font-mono text-zt-text focus:outline-none focus:border-zt-accent uppercase cursor-pointer"
            >
              {utlsOptions.map(fp => (
                <option key={fp} value={fp} className="bg-zt-surface text-zt-text">
                  {fp.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Group 2: Routing & Security Toggles */}
      <div>
        <span className="text-[11px] font-semibold text-zt-text-muted uppercase tracking-wider px-1 mb-1.5 block">
          Tunnel & Routing
        </span>
        <div className="rounded-2xl bg-zt-surface border border-zt-border overflow-hidden divide-y divide-zt-border text-xs">
          {/* Bypass LAN */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-medium text-zt-text">Bypass Local LAN</span>
              <span className="text-[11px] text-zt-text-muted">Direct routing for 192.168.x.x subnets</span>
            </div>
            <button
              type="button"
              onClick={() => updateSetting('bypassLan', !current.bypassLan)}
              className={`w-11 h-6 rounded-full transition-colors duration-200 relative cursor-pointer outline-none ${
                current.bypassLan ? 'bg-zt-accent' : 'bg-zt-border-strong'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out absolute top-1 left-1 ${
                  current.bypassLan ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Kill Switch */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-medium text-zt-text">Kill Switch</span>
              <span className="text-[11px] text-zt-text-muted">Block traffic if tunnel disconnects</span>
            </div>
            <button
              type="button"
              onClick={() => updateSetting('killSwitch', !current.killSwitch)}
              className={`w-11 h-6 rounded-full transition-colors duration-200 relative cursor-pointer outline-none ${
                current.killSwitch ? 'bg-zt-accent' : 'bg-zt-border-strong'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out absolute top-1 left-1 ${
                  current.killSwitch ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Mux Multiplexing */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-medium text-zt-text">Mux Multiplexing</span>
              <span className="text-[11px] text-zt-text-muted">Consolidate TCP streams</span>
            </div>
            <button
              type="button"
              onClick={() => updateSetting('muxEnabled', !current.muxEnabled)}
              className={`w-11 h-6 rounded-full transition-colors duration-200 relative cursor-pointer outline-none ${
                current.muxEnabled ? 'bg-zt-accent' : 'bg-zt-border-strong'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out absolute top-1 left-1 ${
                  current.muxEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Group 3: Carrier Bug Host SNI Tweak */}
      <div>
        <span className="text-[11px] font-semibold text-zt-text-muted uppercase tracking-wider px-1 mb-1.5 block">
          Carrier SNI Override
        </span>
        <div className="rounded-2xl bg-zt-surface border border-zt-border p-3 text-xs">
          <input
            type="text"
            value={current.sriLankaSniTweak}
            onChange={e => updateSetting('sriLankaSniTweak', e.target.value)}
            placeholder="e.g. slt.lk, zero.dialog.lk (optional)"
            className="w-full rounded-xl bg-zt-surface-2 border border-zt-border px-3 py-2 text-xs font-mono text-zt-text placeholder-zt-text-faint focus:outline-none focus:border-zt-accent"
          />
        </div>
      </div>

      {/* Group 4: Support & Community */}
      <div>
        <span className="text-[11px] font-semibold text-zt-text-muted uppercase tracking-wider px-1 mb-1.5 block">
          Support
        </span>
        <div className="rounded-2xl bg-zt-surface border border-zt-border divide-y divide-zt-border overflow-hidden shadow-sm">
          <button
            onClick={handleContactWhatsApp}
            className="w-full px-3.5 py-3 flex items-center justify-between text-xs hover:bg-emerald-500/[0.07] active:bg-emerald-500/[0.12] transition-all cursor-pointer outline-none group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-emerald-500/25 transition-all duration-200 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                <WhatsAppIcon size={16} className="text-emerald-400" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-zt-text group-hover:text-emerald-400 transition-colors">
                    WhatsApp Support
                  </span>
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    Live Chat
                  </span>
                </div>
                <span className="text-[11px] text-zt-text-muted mt-0.5 font-mono">
                  +94 78 838 5465
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-zt-text-faint group-hover:text-emerald-400 transition-colors">
              <span className="text-[11px] font-medium text-zt-text-muted group-hover:text-emerald-300">
                Contact
              </span>
              <ExternalLink size={12} className="text-zt-text-faint group-hover:text-emerald-300" />
            </div>
          </button>

          {/* Diagnostic Logs & Send Report */}
          {onOpenLogs && (
            <button
              onClick={onOpenLogs}
              className="w-full px-3.5 py-3 flex items-center justify-between text-xs hover:bg-zt-surface-2 active:bg-zt-surface-2 transition-all cursor-pointer outline-none group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                  <Terminal size={15} />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-zt-text group-hover:text-zt-accent transition-colors">
                    Send Diagnostic Report
                  </span>
                  <span className="text-[11px] text-zt-text-muted mt-0.5">
                    Capture & share real-time logs with support
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-zt-text-faint group-hover:text-blue-400 transition-colors">
                <span className="text-[11px] font-medium text-zt-text-muted group-hover:text-blue-300">
                  Export
                </span>
                <ChevronRight size={13} />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Group 5: About & Software Updates */}
      <div>
        <span className="text-[11px] font-semibold text-zt-text-muted uppercase tracking-wider px-1 mb-1.5 block">
          About & Updates
        </span>
        <div className="rounded-2xl bg-zt-surface border border-zt-border divide-y divide-zt-border overflow-hidden shadow-sm">
          {/* Version Details Row */}
          <div className="px-3.5 py-3 flex items-center justify-between text-xs">
            <div className="flex flex-col">
              <span className="font-semibold text-zt-text">ZeroTrace Desktop</span>
              <span className="text-[11px] text-zt-text-muted mt-0.5">
                {isMac ? 'Universal Build (Apple Silicon & Intel)' : '64-bit Build (x64 Architecture)'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zt-surface-2 border border-zt-border text-xs font-medium text-zt-text shadow-sm">
              {isMac ? (
                <AppleIcon size={12} className="text-zt-text shrink-0 mb-0.5" />
              ) : (
                <Windows11Icon size={11} className="text-[#0078D4] shrink-0" />
              )}
              <span className="font-mono text-xs font-semibold">v{CURRENT_APP_VERSION}</span>
            </div>
          </div>

          {/* Software Update Action Row */}
          <button
            onClick={handleManualCheckUpdate}
            disabled={isCheckingUpdate}
            className="w-full px-3.5 py-3 flex items-center justify-between text-xs hover:bg-zt-surface-2 active:bg-zt-surface-2 transition-all cursor-pointer outline-none group text-left disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                <RefreshCw
                  size={14}
                  className={isCheckingUpdate ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 transition-transform duration-500 text-blue-400'}
                />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-zt-text group-hover:text-zt-accent transition-colors">
                  Software Update
                </span>
                <span className="text-[11px] text-zt-text-muted mt-0.5">
                  {updateMsg || 'Check for new releases & patches'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-zt-text-faint group-hover:text-zt-text transition-colors">
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
          className="rounded-2xl bg-zt-surface hover:bg-zt-surface-2 border border-zt-border p-3 flex items-center justify-between cursor-pointer transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <Terminal size={15} className="text-blue-400" />
            <span className="text-xs font-medium text-zt-text">System Diagnostics & Logs</span>
          </div>
          <ChevronRight size={14} className="text-zt-text-faint group-hover:text-zt-text transition-colors" />
        </div>
      )}
    </div>
  );
};
