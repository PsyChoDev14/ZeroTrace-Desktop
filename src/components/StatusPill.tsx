import React from 'react';
import { VpnState } from '../types';

export const StatusPill: React.FC<{ state: VpnState }> = ({ state }) => {
  const isConnected = state.status === 'connected';
  const isConnecting = state.status === 'connecting' || state.status === 'stopping';
  const isError = state.status === 'error';

  const label = isConnected
    ? 'PROTECTED'
    : isConnecting
    ? 'CONNECTING'
    : isError
    ? 'FAILED'
    : 'NOT PROTECTED';

  const dotClass = isConnected
    ? 'bg-zt-success shadow-[0_0_8px_#35C77B]'
    : isConnecting
    ? 'bg-zt-accent shadow-[0_0_8px_#5468FF] animate-ping'
    : isError
    ? 'bg-zt-danger shadow-[0_0_8px_#F0533D]'
    : 'bg-zt-text-faint';

  const textClass = isConnected
    ? 'text-zt-success'
    : isConnecting
    ? 'text-zt-accent'
    : isError
    ? 'text-zt-danger'
    : 'text-zt-text-muted';

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zt-surface/80 border border-zt-border text-xs font-mono tracking-wider">
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      <span className={`font-semibold ${textClass}`}>{label}</span>
    </div>
  );
};
