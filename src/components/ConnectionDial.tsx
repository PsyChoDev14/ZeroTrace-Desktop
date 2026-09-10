import React from 'react';
import { Power, Shield, Lock, AlertTriangle } from 'lucide-react';
import { VpnState } from '../types';

interface ConnectionDialProps {
  state: VpnState;
  hasConfig: boolean;
  onClick: () => void;
  disabled?: boolean;
  isLightMode?: boolean;
}

/**
 * ZeroTrace Obsidian & Pearl Cyber Dial
 * Uses SVG-native animateTransform for rotation — bypasses WebKit CSS transform issues on SVG groups.
 * - Connecting: rotating laser comet arc with glowing photon head
 * - Connected: slow ambient aurora sweep
 * - Idle: breathing halo only
 * - Light Mode: Apple HIG frosted pearl dial with crisp contrast
 */
const ConnectionDialComponent: React.FC<ConnectionDialProps> = ({
  state,
  hasConfig,
  onClick,
  disabled = false,
  isLightMode,
}) => {
  const isConnected = state.status === 'connected';
  const isConnecting = state.status === 'connecting' || state.status === 'stopping';
  const isError = state.status === 'error';

  const isLight = isLightMode ?? (typeof document !== 'undefined' && (
    document.documentElement.classList.contains('theme-light') ||
    Boolean(document.querySelector('.theme-light'))
  ));

  const coreBg = isLight
    ? isConnected
      ? 'radial-gradient(circle at 50% 25%, #FFFFFF 0%, #ECFDF5 50%, #D1FAE5 100%)'
      : isConnecting
      ? 'radial-gradient(circle at 50% 25%, #FFFFFF 0%, #EEF2FF 50%, #E0E7FF 100%)'
      : isError
      ? 'radial-gradient(circle at 50% 25%, #FFFFFF 0%, #FEF2F2 50%, #FEE2E2 100%)'
      : 'radial-gradient(circle at 50% 25%, #FFFFFF 0%, #F8FAFC 55%, #EDF2F7 100%)'
    : isConnected
    ? 'radial-gradient(circle at 50% 30%, #0F3324 0%, #081C14 55%, #030A07 100%)'
    : isConnecting
    ? 'radial-gradient(circle at 50% 30%, #172347 0%, #0C1329 55%, #050812 100%)'
    : isError
    ? 'radial-gradient(circle at 50% 30%, #381512 0%, #1E0A08 55%, #0D0403 100%)'
    : 'radial-gradient(circle at 50% 30%, #1A1E2B 0%, #11141E 55%, #090B10 100%)';

  const borderColor = isLight
    ? isConnected
      ? 'rgba(16, 185, 129, 0.7)'
      : isConnecting
      ? 'rgba(79, 70, 229, 0.7)'
      : isError
      ? 'rgba(239, 68, 68, 0.7)'
      : 'rgba(203, 213, 225, 0.85)'
    : isConnected
    ? 'rgba(53, 199, 123, 0.9)'
    : isConnecting
    ? 'rgba(84, 104, 255, 0.9)'
    : isError
    ? 'rgba(240, 83, 61, 0.9)'
    : 'rgba(255, 255, 255, 0.12)';

  const haloBg = isLight
    ? isConnected
      ? 'rgba(16, 185, 129, 0.22)'
      : isConnecting
      ? 'rgba(79, 70, 229, 0.22)'
      : isError
      ? 'rgba(239, 68, 68, 0.22)'
      : 'rgba(99, 102, 241, 0.05)'
    : isConnected
    ? 'rgba(53, 199, 123, 0.35)'
    : isConnecting
    ? 'rgba(84, 104, 255, 0.38)'
    : isError
    ? 'rgba(240, 83, 61, 0.35)'
    : 'rgba(0, 0, 0, 0.4)';

  const boxShadow = isLight
    ? isConnected
      ? '0 8px 32px rgba(16, 185, 129, 0.25), 0 2px 8px rgba(16, 185, 129, 0.1), inset 0 2px 0 #FFFFFF'
      : isConnecting
      ? '0 8px 32px rgba(79, 70, 229, 0.25), 0 2px 8px rgba(79, 70, 229, 0.1), inset 0 2px 0 #FFFFFF'
      : isError
      ? '0 8px 32px rgba(239, 68, 68, 0.25), 0 2px 8px rgba(239, 68, 68, 0.1), inset 0 2px 0 #FFFFFF'
      : '0 12px 28px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04), inset 0 2px 0 #FFFFFF'
    : isConnected
    ? '0 0 35px rgba(53, 199, 123, 0.35), inset 0 0 24px rgba(53, 199, 123, 0.22), inset 0 1.5px 0 rgba(255,255,255,0.35)'
    : isConnecting
    ? '0 0 35px rgba(84, 104, 255, 0.38), inset 0 0 24px rgba(84, 104, 255, 0.25), inset 0 1.5px 0 rgba(255,255,255,0.35)'
    : '0 16px 36px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)';

  return (
    <div className="relative flex items-center justify-center w-52 h-52 select-none my-2 shrink-0">

      {/* 1. Ambient Breathing Aura Halo */}
      <div
        className={`absolute inset-2 rounded-full filter blur-3xl transition-all duration-700 pointer-events-none ${
          isConnected || isConnecting ? 'breathing-halo' : 'opacity-10'
        }`}
        style={{ backgroundColor: haloBg }}
      />

      {/* 2. SVG Precision Arc Track — uses SVG-native animateTransform for WebKit */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        viewBox="0 0 208 208"
      >
        <defs>
          {/* Connecting laser comet gradient */}
          <linearGradient id="laserCometGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5468FF" stopOpacity="0" />
            <stop offset="40%" stopColor="#5468FF" stopOpacity="0.5" />
            <stop offset="80%" stopColor="#60A5FA" stopOpacity="1" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
          </linearGradient>

          {/* Connected aurora sweep gradient */}
          <linearGradient id="auroraSweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#35C77B" stopOpacity="0.4" />
            <stop offset="35%" stopColor="#35C77B" stopOpacity="1" />
            <stop offset="60%" stopColor="#38BDF8" stopOpacity="1" />
            <stop offset="85%" stopColor="#10B981" stopOpacity="1" />
            <stop offset="100%" stopColor="#35C77B" stopOpacity="0.4" />
          </linearGradient>

          {/* Glow filter for photon head */}
          <filter id="cometGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Neon glow for aurora ring */}
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* CONNECTING: rotating laser comet — SVG-native animateTransform (WebKit reliable) */}
        {isConnecting && (
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 104 104"
              to="360 104 104"
              dur="1.2s"
              repeatCount="indefinite"
            />
            {/* Comet arc trail */}
            <circle
              cx="104" cy="104" r="94"
              fill="none"
              stroke="url(#laserCometGrad)"
              strokeWidth="3.5"
              strokeDasharray="175 415"
              strokeLinecap="round"
            />
            {/* Glowing photon head at leading edge */}
            <circle
              cx="198" cy="104" r="6"
              fill="#93C5FD"
              opacity="0.55"
              filter="url(#cometGlow)"
            />
            <circle cx="198" cy="104" r="2.5" fill="#FFFFFF" />
          </g>
        )}

        {/* CONNECTED: slow ambient aurora drift — SVG-native animateTransform */}
        {isConnected && (
          <g filter="url(#neonGlow)">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 104 104"
              to="360 104 104"
              dur="8s"
              repeatCount="indefinite"
            />
            <circle
              cx="104" cy="104" r="94"
              fill="none"
              stroke="url(#auroraSweepGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="200 390"
            />
          </g>
        )}
      </svg>

      {/* 3. Obsidian Glass Core Button */}
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={isConnected ? 'Disconnect' : isConnecting ? 'Connecting…' : isError ? 'Reconnect' : 'Connect'}
        className={`relative z-10 w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-300 group cursor-pointer focus:outline-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 hover:scale-[1.02]'
        }`}
        style={{
          background: coreBg,
          border: `2px solid ${borderColor}`,
          boxShadow,
        }}
      >
        {/* State Icon — bg-transparent kills any background pill artifact */}
        <div className="relative flex items-center justify-center bg-transparent">
          {/* Glow pad behind icon */}
          {isConnected && (
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 blur-lg absolute pointer-events-none" />
          )}
          {isConnecting && (
            <div className="w-14 h-14 rounded-full bg-blue-500/20 blur-lg absolute animate-pulse pointer-events-none" />
          )}

          {isError ? (
            <AlertTriangle
              size={42}
              fill="none"
              className={
                isLight
                  ? 'text-red-600 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                  : 'text-zt-danger drop-shadow-[0_0_12px_rgba(240,83,61,0.7)]'
              }
            />
          ) : isConnected ? (
            <Shield
              size={44}
              fill="none"
              className={
                isLight
                  ? 'text-emerald-600 drop-shadow-[0_0_14px_rgba(16,185,129,0.5)] transition-all duration-300'
                  : 'text-emerald-400 drop-shadow-[0_0_18px_rgba(52,211,153,0.9)] transition-all duration-300'
              }
            />
          ) : isConnecting ? (
            <Lock
              size={40}
              fill="none"
              className={
                isLight
                  ? 'text-indigo-600 drop-shadow-[0_0_14px_rgba(79,70,229,0.5)] animate-pulse transition-all'
                  : 'text-blue-400 drop-shadow-[0_0_18px_rgba(96,165,250,0.9)] animate-pulse transition-all'
              }
            />
          ) : (
            <Power
              size={42}
              fill="none"
              className={`transition-all duration-300 ${
                hasConfig
                  ? isLight
                    ? 'text-slate-600 group-hover:text-indigo-600 group-hover:drop-shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                    : 'text-white/70 group-hover:text-white group-hover:drop-shadow-[0_0_14px_rgba(255,255,255,0.7)]'
                  : isLight
                  ? 'text-slate-300'
                  : 'text-white/30'
              }`}
            />
          )}
        </div>
      </button>
    </div>
  );
};

export const ConnectionDial = React.memo(ConnectionDialComponent);


