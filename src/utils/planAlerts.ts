import { SubscriptionInfo } from '../types';

export interface PlanAlert {
  key: string;
  message: { text: string; vars: Record<string, string | number> };
}

export const EXPIRY_WARN_DAYS = 3;
export const DATA_WARN_PERCENT = 90;

/** Percent of the data limit used, or null for unlimited plans. */
export function usagePercent(sub: SubscriptionInfo): number | null {
  const { limitGb, totalGb, usedPercentage } = sub.usage;
  if (!(limitGb > 0)) return null;
  const pct = usedPercentage > 0 ? usedPercentage : (totalGb / limitGb) * 100;
  return Math.min(100, Math.round(pct));
}

/** Plans that need attention: about to expire, or nearly out of data. Expired plans are skipped. */
export function planAlerts(subs: SubscriptionInfo[]): PlanAlert[] {
  const alerts: PlanAlert[] = [];
  for (const sub of subs) {
    if (sub.expiry.isExpired) continue;
    const plan = sub.planName || sub.packageName;
    if (!sub.expiry.neverExpires && sub.expiry.daysRemaining <= EXPIRY_WARN_DAYS) {
      const n = Math.max(0, sub.expiry.daysRemaining);
      alerts.push({
        key: `exp-${sub.id}-${n}`,
        message: n === 0
          ? { text: '{plan} expires today', vars: { plan } }
          : { text: '{plan} expires in {n}d', vars: { plan, n } },
      });
    }
    const pct = usagePercent(sub);
    if (pct !== null && pct >= DATA_WARN_PERCENT) {
      alerts.push({ key: `data-${sub.id}`, message: { text: '{plan}: {pct}% of data used', vars: { plan, pct } } });
    }
  }
  return alerts;
}
