import { describe, expect, it } from 'vitest';
import {
  DATE_OUTSIDE_EVENT,
  dateOutsideEventMessage,
  formatCivilDate,
  formatEventDateRange
} from '../../shared/domain/dates';
import { dateOutsideEventMessage as eventDateOutside } from '../../shared/domain/events';
import { dateOutsideEventMessage as concertDateOutside } from '../../shared/domain/concerts';
import { formatCivilDate as uiFormatCivilDate, formatDateStack, formatEventDateLabel } from '../../app/utils/event-dates';

describe('date stack', () => {
  it('splits a civil date into uppercase weekday, day, month, and year', () => {
    expect(formatDateStack('2025-04-26')).toEqual({ weekday: 'SAT', day: '26', month: 'APR', year: '2025', range: false });
    expect(formatDateStack('2026-08-19', '2026-08-19').range).toBe(false);
  });

  it('does not shift across month and year boundaries', () => {
    expect(formatDateStack('2026-01-01')).toEqual({ weekday: 'THU', day: '1', month: 'JAN', year: '2026', range: false });
    expect(formatDateStack('2026-12-31')).toEqual({ weekday: 'THU', day: '31', month: 'DEC', year: '2026', range: false });
    expect(formatDateStack('2024-02-29')).toEqual({ weekday: 'THU', day: '29', month: 'FEB', year: '2024', range: false });
    expect(formatDateStack('2024-09-21').month).toBe('SEP');
  });

  it('falls back to the raw value without throwing', () => {
    expect(formatDateStack('not-a-date')).toEqual({ weekday: '', day: 'not-a-date', month: '', year: '', range: false });
    expect(formatDateStack('')).toEqual({ weekday: '', day: '', month: '', year: '', range: false });
    expect(formatDateStack('2026-08-19', 'nope')).toEqual(formatDateStack('2026-08-19'));
    expect(formatDateStack('2026-08-22', '2026-08-19')).toEqual(formatDateStack('2026-08-22'));
  });

  it('shows a festival range and keeps the year when the month changes', () => {
    expect(formatDateStack('2026-08-19', '2026-08-22')).toEqual({
      weekday: '',
      day: '19–22',
      month: 'AUG',
      year: '2026',
      range: true
    });
    expect(formatDateStack('2026-08-30', '2026-09-01')).toEqual({
      weekday: '2026',
      day: '30–1',
      month: 'AUG–SEP',
      year: '2026',
      range: true
    });
    expect(formatDateStack('2026-12-30', '2027-01-01')).toEqual({
      weekday: '2026–2027',
      day: '30–1',
      month: 'DEC–JAN',
      year: '2026–2027',
      range: true
    });
  });
});

describe('civil date display', () => {
  it('formats a Paris civil date as DD/MM/YYYY and ranges the same in domain and UI', () => {
    expect(formatCivilDate('2026-08-18')).toBe('18/08/2026');
    expect(formatEventDateRange('2026-08-18', '2026-08-18')).toBe('18/08/2026');
    expect(formatEventDateRange('2026-08-18', '2026-08-22')).toBe('18/08/2026 – 22/08/2026');
    expect(uiFormatCivilDate('2026-08-18')).toBe('18/08/2026');
    expect(formatEventDateLabel({
      start_date: '2026-08-18',
      end_date: '2026-08-22'
    })).toBe('18/08/2026 – 22/08/2026');
  });

  it('keeps Event and Concert date-outside copy on one formatter', () => {
    const event = { start_date: '2026-08-20', end_date: '2026-08-22' };
    const message = `${DATE_OUTSIDE_EVENT} 20/08/2026 – 22/08/2026`;
    expect(dateOutsideEventMessage(event)).toBe(message);
    expect(eventDateOutside(event)).toBe(message);
    expect(concertDateOutside(event)).toBe(message);
  });
});
