import { describe, expect, it } from 'vitest';
import { formatReadingTime } from '@/utils/time';

describe('formatReadingTime', () => {
  it('shows only minutes under an hour in auto mode', () => {
    expect(formatReadingTime(0)).toBe('0M');
    expect(formatReadingTime(59)).toBe('0M');
    expect(formatReadingTime(45 * 60)).toBe('45M');
  });

  it('shows hours and minutes once an hour has passed in auto mode', () => {
    expect(formatReadingTime(3600)).toBe('1H0M');
    expect(formatReadingTime(2 * 3600 + 5 * 60)).toBe('2H5M');
  });

  it('forces a single unit in minutes and hours modes', () => {
    expect(formatReadingTime(125 * 60, 'minutes')).toBe('125M');
    expect(formatReadingTime(125 * 60, 'hours')).toBe('2.1H');
  });

  it('returns an empty label when hidden, and 0 for bad input', () => {
    expect(formatReadingTime(5000, 'hidden')).toBe('');
    expect(formatReadingTime(Number.NaN)).toBe('0M');
    expect(formatReadingTime(-10)).toBe('0M');
  });
});
