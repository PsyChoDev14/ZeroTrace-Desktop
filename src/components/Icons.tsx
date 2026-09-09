import React from 'react';
import { ProxyProtocol } from '../types';

export const ZeroTraceMark: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="ztMarkGrad" x1="12" y1="6" x2="52" y2="62" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00E5FF" />
        <stop offset="1" stopColor="#5468FF" />
      </linearGradient>
    </defs>
    {/* Shield Outer */}
    <path
      d="M32 6 L52 15 V36 C52 48 42 58 32 62 C22 58 12 48 12 36 V15 Z"
      stroke="url(#ztMarkGrad)"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Severed Trace Lightning Bolt */}
    <path
      d="M32 20 L42 30 H35 L38 44 L25 33 H31 Z"
      fill="#00E5FF"
    />
  </svg>
);

export const ZeroTraceWordmark: React.FC<{ size?: 'sm' | 'md' | 'lg'; showIcon?: boolean; className?: string }> = ({
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 26 : 22;

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {showIcon && <ZeroTraceMark size={iconSize} />}
      <div className={`tracking-[0.22em] font-sans ${textSize}`}>
        <span className="font-extrabold text-zt-text">ZERO</span>
        <span className="font-light text-zt-text-muted">TRACE</span>
      </div>
    </div>
  );
};

export const ProtocolBadge: React.FC<{ protocol: ProxyProtocol }> = ({ protocol }) => {
  const colorMap: Record<ProxyProtocol, { bg: string; text: string; border: string }> = {
    VLESS: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
    VMESS: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
    TROJAN: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    SHADOWSOCKS: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    CUSTOM_JSON: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  };

  const style = colorMap[protocol] || colorMap.VLESS;

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${style.bg} ${style.text} ${style.border}`}
    >
      {protocol === 'CUSTOM_JSON' ? 'JSON' : protocol}
    </span>
  );
};
