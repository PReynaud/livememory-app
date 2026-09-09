import { describe, expect, it } from 'vitest';
import {
  DATE_OUTSIDE_EVENT,
  dateOutsideEventMessage,
  formatCivilDate,
  formatEventDateRange
} from '../../shared/domain/dates';
import { dateOutsideEventMessage as eventDateOutside } from '../../shared/domain/events';
import { dateOutsideEventMessage as concertDateOutside } from '../../shared/domain/concerts';
import { formatCivilDate as uiFormatCivilDate, formatEventDateLabel } from '../../app/utils/event-dates';

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
