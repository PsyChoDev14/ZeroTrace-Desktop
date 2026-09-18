import React, { useState } from 'react';
import { AlertCircle, Shield } from 'lucide-react';
import { AppleIcon, Windows11Icon } from '../components/Icons';
import { openExternalUrl } from '../utils/tauriBridge';
import { CURRENT_APP_VERSION } from '../utils/updater';

interface LoginScreenProps {
  isLightMode: boolean;
  /** A sign-in is in flight: the browser was opened and we're waiting for the deep-link callback. */
  loading: boolean;
  error: string | null;
  onLogin: () => Promise<void> | void;
  onCancel: () => void;
  /** Launch gate only: shows "Use this device offline". Omit when embedded in the Account tab. */
  onOffline?: () => void;
  showFooter?: boolean;
}

type Phase = 'idle' | 'loading' | 'waiting' | 'error';

const COPY: Record<Phase, { heading: string; sub: string; hint: string }> = {
  idle: {
    heading: 'Sign in to continue',
    sub: 'Link this device to your ZeroTrace account to sync configs and your license.',
    hint: 'We store no browsing data. Sign-in identifies your license — nothing else.',
  },
  loading: {
    heading: 'Opening your browser',
    sub: 'Finish signing in with Google, then come back to this window.',
    hint: 'We store no browsing data. Sign-in identifies your license — nothing else.',
  },
  waiting: {
    heading: 'Waiting for your browser',
    sub: 'Approve the sign-in in the tab that just opened. This window continues on its own.',
    hint: 'Nothing opened? Your default browser may be blocked by the active tunnel.',
  },
  error: {
    heading: 'Sign-in failed',
    sub: 'ZeroTrace could not complete the handshake with Google.',
    hint: 'Still failing? Message support on WhatsApp and include your diagnostics log.',
  },
};

const GoogleLogo: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" style={{ flex: 'none', position: 'relative' }} aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export const LoginScreen: React.FC<LoginScreenProps> = ({
  isLightMode,
  loading,
  error,
  onLogin,
  onCancel,
  onOffline,
  showFooter = false,
}) => {
  const [opening, setOpening] = useState(false);
  const [googleHover, setGoogleHover] = useState(false);
  const [ghostHover, setGhostHover] = useState(false);

  const dark = !isLightMode;
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent || '');

  const phase: Phase = opening ? 'loading' : loading ? 'waiting' : error ? 'error' : 'idle';
  const copy = COPY[phase];

  const handleGoogle = async () => {
    if (opening) return;
    setOpening(true);
    try {
      await onLogin();
    } finally {
      setOpening(false);
    }
  };

  const googleStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 46,
    width: '100%',
    borderRadius: 18,
    border: 0,
    cursor: opening ? 'default' : 'pointer',
    font: 'inherit',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    transition: 'all .2s cubic-bezier(.16,1,.3,1)',
    color: dark ? '#F4F4F6' : '#1F1F1F',
    transform: googleHover && !opening ? 'translateY(-1px)' : 'none',
    background: dark
      ? googleHover
        ? 'linear-gradient(180deg, rgba(255,255,255,.19) 0%, rgba(255,255,255,.09) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.06) 100%)'
      : googleHover
        ? 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,.97) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(250,251,253,.92) 100%)',
    boxShadow: dark
      ? googleHover
        ? '0 14px 30px -12px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.26)'
        : '0 10px 26px -12px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.18)'
      : googleHover
        ? '0 14px 28px -12px rgba(15,23,42,.34), inset 0 1px 0 rgba(255,255,255,1)'
        : '0 10px 24px -12px rgba(15,23,42,.3), inset 0 1px 0 rgba(255,255,255,.9)',
  };

  const ghostStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    width: '100%',
    borderRadius: 18,
    border: 0,
    cursor: 'pointer',
    font: 'inherit',
    fontSize: 12,
    fontWeight: 500,
    color: ghostHover ? 'rgb(var(--zt-text))' : 'rgb(var(--zt-text-muted))',
    background: ghostHover
      ? dark ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.85)'
      : dark ? 'rgba(255,255,255,.045)' : 'rgba(15,23,42,.035)',
    boxShadow: 'inset 0 0 0 1px var(--glass-line)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: 'all .2s cubic-bezier(.16,1,.3,1)',
  };

  const linkStyle = (color: string): React.CSSProperties => ({
    border: 0,
    background: 'transparent',
    padding: 0,
    font: 'inherit',
    fontSize: 11.5,
    fontWeight: 500,
    color,
    cursor: 'pointer',
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col px-[18px] pb-[18px] animate-screen-enter select-none">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center text-center">
        {/* Hero orb */}
        <div style={{ position: 'relative', width: 104, height: 104, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <span
            style={{
              position: 'absolute',
              inset: -10,
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg,rgba(0,229,255,.35),rgba(84,104,255,.05),rgba(84,104,255,.4),rgba(0,229,255,.05),rgba(0,229,255,.35))',
              filter: 'blur(16px)',
              animation: 'ambientDrift 8s linear infinite',
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: 10,
              borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(84,104,255,.5) 0%,rgba(0,229,255,.1) 58%,transparent 74%)',
              animation: 'pulseAura 2.2s ease-in-out infinite',
            }}
          />
          <span
            style={{
              position: 'absolute',
              width: 78,
              height: 78,
              borderRadius: '50%',
              background: dark
                ? 'linear-gradient(180deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,.02) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,.95) 0%, rgba(255,255,255,.55) 100%)',
              boxShadow: dark
                ? 'inset 0 1px 0 rgba(255,255,255,.3), 0 14px 30px -14px rgba(0,0,0,.8)'
                : 'inset 0 1px 0 rgba(255,255,255,1), 0 14px 30px -16px rgba(15,23,42,.35)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          />
          {phase === 'loading' && (
            <svg width="104" height="104" viewBox="0 0 104 104" fill="none" style={{ position: 'absolute', inset: 0, animation: 'laserSpin 1.2s linear infinite' }} aria-hidden="true">
              <circle cx="52" cy="52" r="49" stroke="rgba(84,104,255,.16)" strokeWidth="1.5" />
              <path d="M52 3 a49 49 0 0 1 49 49" stroke="#00E5FF" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
          <svg width="52" height="52" viewBox="0 0 64 64" fill="none" style={{ position: 'relative' }} aria-hidden="true">
            <defs>
              <linearGradient id="ztLoginHero" x1="12" y1="6" x2="52" y2="62" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00E5FF" />
                <stop offset="1" stopColor="#5468FF" />
              </linearGradient>
            </defs>
            <path d="M32 6 L52 15 V36 C52 48 42 58 32 62 C22 58 12 48 12 36 V15 Z" stroke="url(#ztLoginHero)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M32 20 L42 30 H35 L38 44 L25 33 H31 Z" fill="#00E5FF" />
          </svg>
        </div>

        <div style={{ marginTop: 16, fontSize: 14, letterSpacing: '0.24em', lineHeight: 1 }}>
          <span style={{ fontWeight: 800, color: 'rgb(var(--zt-text))' }}>ZERO</span>
          <span style={{ fontWeight: 300, color: 'rgb(var(--zt-text-muted))' }}>TRACE</span>
        </div>

        <h1 style={{ margin: '20px 0 0', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgb(var(--zt-text))' }}>
          {copy.heading}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'rgb(var(--zt-text-muted))', maxWidth: 276 }}>
          {copy.sub}
        </p>

        {phase === 'error' && (
          <div
            className="break-words"
            style={{
              marginTop: 18,
              width: '100%',
              display: 'flex',
              gap: 9,
              alignItems: 'flex-start',
              textAlign: 'left',
              padding: '11px 13px',
              borderRadius: 18,
              background: 'var(--zt-danger-soft)',
              boxShadow: 'inset 0 0 0 1px rgb(var(--zt-danger) / 0.26)',
            }}
          >
            <AlertCircle size={14} style={{ flex: 'none', marginTop: 1, color: 'rgb(var(--zt-danger))' }} />
            <span style={{ fontSize: 11.5, lineHeight: 1.5, color: 'rgb(var(--zt-danger))', minWidth: 0 }}>{error}</span>
          </div>
        )}

        <div style={{ width: '100%', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={opening}
            style={googleStyle}
            onMouseEnter={() => setGoogleHover(true)}
            onMouseLeave={() => setGoogleHover(false)}
          >
            <span style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', background: 'linear-gradient(180deg,var(--g-hi) 0%,transparent 52%)' }} />
            {phase !== 'loading' && <GoogleLogo />}
            {phase === 'loading' && (
              <span style={{ position: 'relative', width: 16, height: 16, flex: 'none', borderRadius: '50%', border: '2px solid var(--g-spin)', borderTopColor: 'transparent', animation: 'laserSpin 1.2s linear infinite' }} />
            )}
            <span style={{ position: 'relative', fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.008em' }}>
              {phase === 'loading' ? 'Opening browser…' : phase === 'error' ? 'Try again with Google' : 'Continue with Google'}
            </span>
          </button>

          {phase === 'waiting' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, paddingTop: 2 }}>
              <button type="button" onClick={handleGoogle} style={linkStyle('rgb(var(--zt-accent))')}>Open the link again</button>
              <span style={{ width: 1, height: 10, background: 'var(--glass-line)' }} />
              <button type="button" onClick={onCancel} style={linkStyle('rgb(var(--zt-text-muted))')}>Cancel</button>
            </div>
          )}

          {phase === 'idle' && onOffline && (
            <button
              type="button"
              onClick={onOffline}
              style={ghostStyle}
              onMouseEnter={() => setGhostHover(true)}
              onMouseLeave={() => setGhostHover(false)}
            >
              <Shield size={13} strokeWidth={2} />
              Use this device offline
            </button>
          )}
        </div>

        <p style={{ margin: '16px 0 0', fontSize: 10.5, lineHeight: 1.55, color: 'rgb(var(--zt-text-muted))', maxWidth: 266 }}>
          {copy.hint}
        </p>
      </div>

      {showFooter && (
        <div
          className="shrink-0 flex items-center justify-between gap-3"
          style={{ paddingTop: 13, borderTop: '1px solid var(--glass-line)' }}
        >
          <button
            type="button"
            onClick={() => openExternalUrl('https://wa.me/94788385465')}
            style={{ ...linkStyle('rgb(var(--zt-accent))'), fontSize: 10.5 }}
          >
            Support
          </button>
          <div className="flex items-center gap-1.5" style={{ color: 'rgb(var(--zt-text-muted))' }}>
            {isMac ? <AppleIcon size={11} /> : <Windows11Icon size={11} />}
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: '.02em' }}>v{CURRENT_APP_VERSION}</span>
          </div>
        </div>
      )}
    </div>
  );
};
