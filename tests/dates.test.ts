import { describe, expect, it } from 'vitest';
import { addMonths, fmtDayMonth, fmtRange, isoWeek, periodKeysInRange, periodStart, startOfWeek } from '../src/lib/dates';

describe('dates', () => {
  it('weeks start on Monday', () => {
    expect(startOfWeek('2026-11-25')).toBe('2026-11-23'); // Wed → Mon
    expect(startOfWeek('2026-11-29')).toBe('2026-11-23'); // Sun → Mon
    expect(startOfWeek('2026-11-23')).toBe('2026-11-23');
  });

  it('maps a date to its period key', () => {
    expect(periodStart('daily', '2026-11-25')).toBe('2026-11-25');
    expect(periodStart('weekly', '2026-11-25')).toBe('2026-11-23');
    expect(periodStart('monthly', '2026-11-25')).toBe('2026-11-01');
  });

  it('lists period keys overlapping a range', () => {
    expect(periodKeysInRange('weekly', '2026-11-01', '2026-11-25')).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    expect(periodKeysInRange('monthly', '2026-10-15', '2026-12-01')).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
    expect(periodKeysInRange('daily', '2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  });

  it('clamps month arithmetic to the month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('computes ISO week numbers', () => {
    expect(isoWeek('2026-11-16')).toBe(47);
    expect(isoWeek('2027-01-01')).toBe(53); // Friday of ISO week 53 of 2026
  });

  it('formats ranges and short dates', () => {
    expect(fmtRange('2026-11-23', '2026-11-29')).toBe('23 – 29 Nov');
    expect(fmtRange('2026-11-30', '2026-12-06')).toBe('30 Nov – 6 Dec');
    expect(fmtDayMonth('2026-09-13')).toBe('13 Sep');
  });
});
