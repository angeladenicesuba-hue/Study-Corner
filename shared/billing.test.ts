import { describe, it, expect } from 'vitest';
import {
  billableHours,
  computeTimeCharge,
  computeElapsedMinutes,
  computePlanEndDate,
  isPlanActiveOnDate,
  isWithinOperatingHours,
} from './billing';

describe('Study Corner Billing Rules (Feb 2, 2026 Price List)', () => {
  it('enforces NO grace period: any minute past an hour rounds up to the next hour', () => {
    expect(billableHours(1)).toBe(1);
    expect(billableHours(45)).toBe(1);
    expect(billableHours(60)).toBe(1);
    expect(billableHours(61)).toBe(2);
    expect(billableHours(120)).toBe(2);
    expect(billableHours(121)).toBe(3); // 2h 01m -> 3 hours
    expect(billableHours(300)).toBe(5); // 5h 00m -> 5 hours
    expect(billableHours(301)).toBe(6); // 5h 01m -> 6 hours
    expect(billableHours(600)).toBe(10); // 10h 00m -> 10 hours
    expect(billableHours(601)).toBe(11); // 10h 01m -> 11 hours
  });

  it('computes exact non-member and member tier prices', () => {
    // 1-2 hours: 80 non-member, 70 member
    expect(computeTimeCharge(120, false).amount).toBe(80);
    expect(computeTimeCharge(120, true).amount).toBe(70);

    // 2h 01m -> 3-5 hours tier: 130 non-member, 120 member
    expect(computeTimeCharge(121, false).amount).toBe(130);
    expect(computeTimeCharge(121, true).amount).toBe(120);

    // 5h 01m -> 6-10 hours tier: 190 non-member, 180 member
    expect(computeTimeCharge(301, false).amount).toBe(190);
    expect(computeTimeCharge(301, true).amount).toBe(180);

    // 10h 01m -> 11-13 hours tier: 230 non-member, 210 member
    expect(computeTimeCharge(601, false).amount).toBe(230);
    expect(computeTimeCharge(601, true).amount).toBe(210);
  });

  it('charges 0 for time when covered by an active plan', () => {
    const res = computeTimeCharge(240, true, true);
    expect(res.amount).toBe(0);
    expect(res.hours).toBe(4);
  });

  it('caps elapsed minutes at closing hour (9:00 PM) so forgotten checkouts do not overcharge', () => {
    // Checked in at 8:00 AM, forgot to check out until 10:30 PM -> capped at 9:00 PM (13 hours = 780 mins)
    const timeIn = '2026-11-11T08:00:00.000+08:00';
    const timeOut = '2026-11-11T22:30:00.000+08:00';
    const mins = computeElapsedMinutes(timeIn, timeOut, 21);
    expect(mins).toBe(780);
    expect(computeTimeCharge(mins, false).amount).toBe(230);
  });

  it('validates operating hours (8 AM to 9 PM)', () => {
    expect(isWithinOperatingHours(new Date('2026-11-11T07:59:00'))).toBe(false);
    expect(isWithinOperatingHours(new Date('2026-11-11T08:00:00'))).toBe(true);
    expect(isWithinOperatingHours(new Date('2026-11-11T20:59:00'))).toBe(true);
    expect(isWithinOperatingHours(new Date('2026-11-11T21:00:00'))).toBe(false);
  });

  it('calculates consecutive-day plan validity accurately', () => {
    const end = computePlanEndDate('2026-11-01', 7);
    expect(end).toBe('2026-11-07');
    const sub = { startDate: '2026-11-01', endDate: end, active: 1 };
    expect(isPlanActiveOnDate(sub, '2026-11-01')).toBe(true);
    expect(isPlanActiveOnDate(sub, '2026-11-07')).toBe(true);
    expect(isPlanActiveOnDate(sub, '2026-11-08')).toBe(false);
  });
});
