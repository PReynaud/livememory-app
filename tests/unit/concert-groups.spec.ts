import { describe, expect, it } from 'vitest';
import { dayConcertCountLabel } from '../../app/utils/concert-groups';

describe('day concert count', () => {
  it('uses the singular only for one concert', () => {
    expect(dayConcertCountLabel(1)).toBe('1 concert');
    expect(dayConcertCountLabel(0)).toBe('0 concerts');
    expect(dayConcertCountLabel(27)).toBe('27 concerts');
  });
});
