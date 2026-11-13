import { RateTier, PlanRate, PlanSub } from './types';

export const DEFAULT_TIERS: RateTier[] = [
  { maxHours: 2,  label: '1-2 hours',   nonMember: 80,  member: 70  },
  { maxHours: 5,  label: '3-5 hours',   nonMember: 130, member: 120 },
  { maxHours: 10, label: '6-10 hours',  nonMember: 190, member: 180 },
  { maxHours: 13, label: '11-13 hours', nonMember: 230, member: 210 },
];

export const DEFAULT_PLANS: PlanRate[] = [
  { type: 'weekly',     label: 'Weekly (7 Days)',      days: 7,  nonMember: 1000, member: 800  },
  { type: 'semi_month', label: 'Semi-Month (15 Days)', days: 15, nonMember: 1700, member: 1500 },
  { type: 'monthly',    label: 'Monthly (30 Days)',    days: 30, nonMember: 2500, member: 2200 },
];

export const DEFAULT_OPEN_HOUR = 8;   // 8:00 AM
export const DEFAULT_CLOSE_HOUR = 21; // 9:00 PM

/**
 * No grace period: any started hour counts as a full hour.
 * Minimum 1 hour for any check-in.
 * Example: 1m -> 1h, 60m -> 1h, 61m -> 2h, 120m -> 2h, 121m -> 3h.
 */
export function billableHours(minutes: number): number {
  if (minutes <= 0) return 1;
  return Math.max(1, Math.ceil(minutes / 60));
}

/**
 * Caps effective checkout time at closing hour (default 9:00 PM on the same day)
 * so a forgotten Time Out does not overcharge the customer past operating hours.
 */
export function computeElapsedMinutes(
  timeInIso: string,
  timeOutIso: string,
  closeHour: number = DEFAULT_CLOSE_HOUR
): number {
  const start = new Date(timeInIso);
  const end = new Date(timeOutIso);

  const closingTime = new Date(start);
  closingTime.setHours(closeHour, 0, 0, 0);

  const effectiveEnd = end > closingTime && start < closingTime ? closingTime : end;
  const diffMs = effectiveEnd.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diffMs / 60000));
}

export function selectTier(
  minutes: number,
  tiers: RateTier[] = DEFAULT_TIERS
): { tier: RateTier; hours: number } {
  const hours = billableHours(minutes);
  const sorted = [...tiers].sort((a, b) => a.maxHours - b.maxHours);
  const matched = sorted.find((t) => hours <= t.maxHours) ?? sorted[sorted.length - 1];
  return { tier: matched, hours };
}

export function computeTimeCharge(
  minutes: number,
  isMember: boolean,
  hasActivePlan: boolean = false,
  tiers: RateTier[] = DEFAULT_TIERS
): { amount: number; hours: number; tierLabel: string } {
  const { tier, hours } = selectTier(minutes, tiers);
  if (hasActivePlan) {
    return {
      amount: 0,
      hours,
      tierLabel: `Covered by Plan (${hours}h stayed)`,
    };
  }
  const amount = isMember ? tier.member : tier.nonMember;
  return {
    amount,
    hours,
    tierLabel: `${tier.label} (${isMember ? 'Member' : 'Non-Member'})`,
  };
}

/**
 * Checks whether a time is within operating hours (default 8:00 AM to 8:59 PM).
 */
export function isWithinOperatingHours(
  date: Date,
  openHour: number = DEFAULT_OPEN_HOUR,
  closeHour: number = DEFAULT_CLOSE_HOUR
): boolean {
  const h = date.getHours();
  return h >= openHour && h < closeHour;
}

/**
 * Checks if it is approaching closing time (8:45 PM to 8:59 PM).
 */
export function isClosingSoon(
  date: Date,
  closeHour: number = DEFAULT_CLOSE_HOUR
): boolean {
  const h = date.getHours();
  const m = date.getMinutes();
  return h === closeHour - 1 && m >= 45;
}

/**
 * Computes inclusive end date (YYYY-MM-DD) for consecutive-day plans.
 * Example: startDate 2026-11-01 + 7 days = valid through 2026-11-07.
 */
export function computePlanEndDate(startDateYmd: string, days: number): string {
  const [y, m, d] = startDateYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Math.max(1, days) - 1);
  return dt.toISOString().slice(0, 10);
}

export function isPlanActiveOnDate(plan: Pick<PlanSub, 'startDate' | 'endDate' | 'active'>, dateYmd: string): boolean {
  if (!plan.active) return false;
  return dateYmd >= plan.startDate && dateYmd <= plan.endDate;
}

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
