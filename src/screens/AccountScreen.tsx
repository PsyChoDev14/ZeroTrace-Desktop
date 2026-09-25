import React, { useState } from 'react';
import { LogOut, RefreshCw, Wallet, AlertCircle, Wifi } from 'lucide-react';
import { SubscriptionInfo, UserProfile } from '../types';
import { LoginScreen } from './LoginScreen';
import { t } from '../i18n';
import { usagePercent, DATA_WARN_PERCENT } from '../utils/planAlerts';

// Profile picture with an initial-letter fallback when the backend sends none or the image fails to load.
const Avatar: React.FC<{ name: string; url?: string }> = ({ name, url }) => {
  const [failed, setFailed] = useState(false);
  const showImage = !!url && !failed;
  return (
    <div className="w-11 h-11 rounded-full bg-zt-accent/15 border border-zt-accent/40 text-zt-accent flex items-center justify-center shrink-0 overflow-hidden text-base font-bold">
      {showImage ? (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        (name.trim()[0] || '?').toUpperCase()
      )}
    </div>
  );
};

const expiryLabel = (sub: SubscriptionInfo): string => {
  const { neverExpires, isExpired, daysRemaining } = sub.expiry;
  if (neverExpires) return t('Never expires');
  if (isExpired) {
    const n = Math.abs(daysRemaining);
    return n > 0 ? t('Expired {n}d ago', { n }) : t('Expired');
  }
  return t('{n}d left', { n: daysRemaining });
};

interface AccountScreenProps {
  account: UserProfile | null;
  subscriptions: SubscriptionInfo[];
  loading: boolean;
  error: string | null;
  isLightMode: boolean;
  onLogin: () => Promise<void> | void;
  onCancel: () => void;
  onLogout: () => void;
  onRefresh: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  account,
  subscriptions,
  loading,
  error,
  isLightMode,
  onLogin,
  onCancel,
  onLogout,
  onRefresh,
}) => {
  if (!account) {
    return (
      <LoginScreen
        isLightMode={isLightMode}
        loading={loading}
        error={error}
        onLogin={onLogin}
        onCancel={onCancel}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col px-4 pt-3 pb-4 max-w-sm mx-auto w-full overflow-y-auto space-y-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 shrink-0">
        <h1 className="text-base font-bold text-zt-text tracking-tight">{t('Account')}</h1>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-zt-text-faint hover:text-zt-text hover:bg-zt-surface-2 transition-colors disabled:opacity-50"
          title={t('Refresh')}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-zt-danger bg-zt-danger-soft border border-zt-danger/20 rounded-lg px-2.5 py-1.5">
          <span className="flex items-center gap-1.5"><AlertCircle size={13} /> {error}</span>
          <button onClick={onRefresh} className="font-semibold underline shrink-0">{t('Retry')}</button>
        </div>
      )}

      {/* Profile Card */}
      <div className="p-3.5 rounded-2xl bg-zt-surface border border-zt-border space-y-2.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Avatar name={account.name} url={account.avatarUrl} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-zt-text truncate">{account.name}</div>
            <div className="text-[11px] text-zt-text-faint truncate">{account.email}</div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs pt-2 border-t border-zt-border">
          <span className="flex items-center gap-1.5 text-zt-text-faint"><Wallet size={13} /> {t('Balance')}</span>
          <span className="font-mono font-bold text-zt-text">
            LKR {account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Subscriptions */}
      <div>
        <span className="text-[11px] font-semibold text-zt-text-faint uppercase tracking-wider px-1 mb-1.5 block">
          {t('Subscriptions')}
        </span>
        {subscriptions.length === 0 ? (
          <div className="rounded-2xl bg-zt-surface border border-zt-border p-4 text-center text-xs text-zt-text-faint">
            {t('No active subscriptions on this account.')}
          </div>
        ) : (
          <div className="space-y-2">
            {subscriptions.map(sub => (
              <div key={sub.id} className="rounded-2xl bg-zt-surface border border-zt-border p-3 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zt-text truncate">{sub.planName}</span>
                  <span
                    className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                      sub.expiry.isExpired
                        ? 'bg-zt-danger-soft text-zt-danger border-zt-danger/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    {sub.expiry.isExpired ? t('Expired') : sub.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-zt-text-faint">
                  <Wifi size={12} />
                  <span className="truncate">{sub.packageName || sub.serverLocation}</span>
                </div>
                {(() => {
                  const pct = usagePercent(sub);
                  if (pct === null) return null;
                  const bar = pct >= DATA_WARN_PERCENT ? 'bg-zt-danger' : pct >= 75 ? 'bg-zt-warn' : 'bg-zt-accent';
                  return (
                    <div className="pt-1">
                      <div className="h-1.5 rounded-full bg-zt-surface-2 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-[10px] text-zt-text-faint text-right">{t('{pct}% used', { pct })}</div>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between text-[11px] font-mono text-zt-text-faint pt-1 border-t border-zt-border">
                  <span>{expiryLabel(sub)}</span>
                  <span>
                    {sub.usage.totalGb.toFixed(1)} / {sub.usage.limitGb > 0 ? `${sub.usage.limitGb.toFixed(0)} GB` : '∞'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onLogout}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zt-surface border border-zt-border text-zt-danger text-xs font-semibold active:scale-95 transition-transform"
      >
        <LogOut size={14} />
        {t('Sign Out')}
      </button>
    </div>
  );
};
