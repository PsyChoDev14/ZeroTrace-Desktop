import React from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Globe, Plus, ShieldCheck, Zap } from 'lucide-react';
import { ProxyConfig, TrafficStats, VpnState } from '../types';
import { ConnectionDial } from '../components/ConnectionDial';
import { formatDuration, formatPing, formatSpeed } from '../utils/formatters';

interface HomeScreenProps {
  vpnState: VpnState;
  selectedConfig: ProxyConfig | null;
  trafficStats: TrafficStats;
  onToggleConnect: () => void;
  onOpenAddModal: () => void;
  onNavigateToConfigs: () => void;
  onPing: (id: string) => void;
}

/**
 * Minimalist, Balanced Home Screen
 * - Vertically centered connection group (Dial + Status + Server Pill)
 * - Eliminates awkward lower-screen drop
 * - Clean visual hierarchy with generous breathing room
 */
const HomeScreenComponent: React.FC<HomeScreenProps> = ({
  vpnState,
  selectedConfig,
  trafficStats,
  onToggleConnect,
  onOpenAddModal,
  onNavigateToConfigs,
}) => {
  const isConnected = vpnState.status === 'connected';
  const isConnecting = vpnState.status === 'connecting' || vpnState.status === 'stopping';
  const pingInfo = selectedConfig ? formatPing(selectedConfig.pingMs) : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-4 max-w-sm mx-auto w-full select-none">
      {/* 1. Main Central Dial */}
      <ConnectionDial
        state={vpnState}
        hasConfig={selectedConfig !== null}
        onClick={onToggleConnect}
      />

      {/* 2. Dynamic Status Headline & Subtitle */}
      <div className="mt-3 flex flex-col items-center text-center">
        {isConnected ? (
          <>
            <div className="text-3xl font-mono font-bold tracking-tight text-white drop-shadow-sm">
              {formatDuration(trafficStats.uptimeSeconds)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zt-success font-medium mt-1">
              <ShieldCheck size={14} />
              <span>Protected Tunnel Active</span>
            </div>
          </>
        ) : isConnecting ? (
          <>
            <div className="text-base font-semibold text-zt-accent tracking-tight animate-pulse">
              Securing Tunnel…
            </div>
            <span className="text-xs text-white/50 mt-0.5">
              Connecting to {selectedConfig?.name || 'server'}
            </span>
          </>
        ) : (
          <>
            <div className="text-base font-semibold text-white tracking-tight">
              {selectedConfig ? 'Ready to Connect' : 'No Server Selected'}
            </div>
            <span className="text-xs text-white/40 mt-0.5">
              {selectedConfig
                ? 'Tap dial to route traffic through ZeroTrace'
                : 'Add a server node to begin'}
            </span>
          </>
        )}
      </div>

      {/* 3. Live Throughput Inline Pill (Only when connected) */}
      {isConnected && (
        <div className="flex items-center gap-4 mt-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <ArrowDown size={13} />
            <span>{formatSpeed(trafficStats.downloadSpeed)}</span>
          </div>
          <div className="w-px h-3 bg-white/15" />
          <div className="flex items-center gap-1.5 text-blue-400">
            <ArrowUp size={13} />
            <span>{formatSpeed(trafficStats.uploadSpeed)}</span>
          </div>
        </div>
      )}

      {/* 4. Server Selector Pill (Grouped directly below dial & status) */}
      <div className="w-full max-w-[320px] mt-6">
        {selectedConfig ? (
          <button
            onClick={onNavigateToConfigs}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 transition-all group cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                <Globe size={15} />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-xs font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                  {selectedConfig.name}
                </span>
                <span className="text-[10px] font-mono text-white/40 truncate">
                  {selectedConfig.protocol.toUpperCase()} • {selectedConfig.server}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              {pingInfo && (
                <span className={`text-[10px] font-mono font-medium ${pingInfo.colorClass}`}>
                  {pingInfo.text}
                </span>
              )}
              <ChevronRight size={14} className="text-white/30 group-hover:text-white/70 transition-colors" />
            </div>
          </button>
        ) : (
          <button
            onClick={onOpenAddModal}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/8 border border-dashed border-white/15 hover:border-blue-500/50 transition-all text-white/80 group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <Plus size={15} />
              </div>
              <span className="text-xs font-medium text-white/80 group-hover:text-white">
                Add Server Configuration
              </span>
            </div>
            <Zap size={14} className="text-white/30 group-hover:text-blue-400" />
          </button>
        )}
      </div>
    </div>
  );
};

export const HomeScreen = React.memo(HomeScreenComponent);

