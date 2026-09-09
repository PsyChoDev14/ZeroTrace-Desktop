import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, Clock } from 'lucide-react';
import { ProxyConfig, TrafficStats, VpnState } from '../types';
import { formatBytes, formatDuration, formatSpeed } from '../utils/formatters';

interface StatisticsScreenProps {
  vpnState: VpnState;
  selectedConfig: ProxyConfig | null;
  trafficStats: TrafficStats;
}

/**
 * Minimalist Statistics & Telemetry Screen
 * - Clean waveform chart
 * - Balanced 2-column metrics cards with breathing room
 * - iOS-style technical parameters summary
 */
export const StatisticsScreen: React.FC<StatisticsScreenProps> = ({
  vpnState,
  selectedConfig,
  trafficStats,
}) => {
  const isConnected = vpnState.status === 'connected';

  // Keep sliding window of last 24 throughput data points for SVG waveform
  const [history, setHistory] = useState<{ down: number; up: number }[]>(
    Array.from({ length: 24 }, () => ({ down: 0, up: 0 }))
  );

  useEffect(() => {
    setHistory(prev => [
      ...prev.slice(1),
      { down: trafficStats.downloadSpeed, up: trafficStats.uploadSpeed },
    ]);
  }, [trafficStats.downloadSpeed, trafficStats.uploadSpeed]);

  const maxSpeed = Math.max(1024 * 1024, ...history.map(h => Math.max(h.down, h.up)));
  const pointsDown = history.map((h, i) => {
    const x = (i / (history.length - 1)) * 300;
    const y = 70 - (h.down / maxSpeed) * 60;
    return `${x},${y}`;
  }).join(' ');

  const pointsUp = history.map((h, i) => {
    const x = (i / (history.length - 1)) * 300;
    const y = 70 - (h.up / maxSpeed) * 60;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="flex-1 flex flex-col px-4 pt-3 pb-4 max-w-sm mx-auto w-full overflow-y-auto space-y-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 shrink-0">
        <h1 className="text-base font-bold text-white tracking-tight">Activity</h1>
        {isConnected && selectedConfig && (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            {selectedConfig.name}
          </span>
        )}
      </div>

      {/* Waveform Card */}
      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white/90">Throughput</span>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {formatSpeed(trafficStats.downloadSpeed)}
            </span>
            <span className="flex items-center gap-1 text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              {formatSpeed(trafficStats.uploadSpeed)}
            </span>
          </div>
        </div>

        {/* SVG Waveform */}
        <div className="h-20 w-full relative bg-white/5 rounded-xl p-1 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 300 70" preserveAspectRatio="none">
            <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" />
            <line x1="0" y1="45" x2="300" y2="45" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" />
            <polyline
              fill="none"
              stroke="#35C77B"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsDown}
            />
            <polyline
              fill="none"
              stroke="#5468FF"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsUp}
            />
          </svg>
        </div>
      </div>

      {/* 2-Column Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
            <ArrowDown size={14} />
            <span>Downloaded</span>
          </div>
          <div className="text-base font-mono font-bold text-white mt-1.5">
            {formatBytes(trafficStats.totalDownloaded)}
          </div>
          <span className="text-[10px] text-white/40">Total session bytes</span>
        </div>

        <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-1.5 text-blue-400 text-xs font-semibold">
            <ArrowUp size={14} />
            <span>Uploaded</span>
          </div>
          <div className="text-base font-mono font-bold text-white mt-1.5">
            {formatBytes(trafficStats.totalUploaded)}
          </div>
          <span className="text-[10px] text-white/40">Total session bytes</span>
        </div>
      </div>

      {/* Session Duration */}
      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-white/90">
          <Clock size={15} className="text-amber-400" />
          <span>Active Tunnel Duration</span>
        </div>
        <span className="text-xs font-mono font-bold text-white">
          {formatDuration(trafficStats.uptimeSeconds)}
        </span>
      </div>

      {/* Grouped Tunnel Info */}
      <div>
        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider px-1 mb-1.5 block">
          Tunnel Details
        </span>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-xs space-y-2 font-mono">
          <div className="flex justify-between">
            <span className="text-white/40">ENGINE</span>
            <span className="text-white/90">Xray-Core + TUN L3</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">VIRTUAL IP</span>
            <span className="text-white/90">10.233.233.2</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">ROUTING</span>
            <span className="text-white/90">Split 0.0.0.0/1, 128.0.0.0/1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
