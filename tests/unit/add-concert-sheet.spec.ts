import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  closedAddConcertSheetState,
  openAddConcertSheetState
} from '../../app/utils/add-concert-sheet-state';

describe('add concert sheet open/close state', () => {
  it('keeps a locked Bill when openSheet is called without options while already open', () => {
    const locked = openAddConcertSheetState(
      { open: false, eventId: null, lockEvent: false },
      { eventId: 'event-1', lockEvent: true }
    );

    expect(locked).toEqual({
      open: true,
      eventId: 'event-1',
      lockEvent: true
    });

    expect(openAddConcertSheetState(locked)).toEqual({
      open: true,
      eventId: 'event-1',
      lockEvent: true
    });
  });

  it('clears lock when opening from closed without options, and closeSheet clears lock', () => {
    const locked = openAddConcertSheetState(
      { open: false, eventId: null, lockEvent: false },
      { eventId: 'event-1', lockEvent: true }
    );
    const closed = closedAddConcertSheetState();

    expect(closed).toEqual({
      open: false,
      eventId: null,
      lockEvent: false
    });
    expect(closed.eventId).not.toBe(locked.eventId);

    expect(openAddConcertSheetState(closed)).toEqual({
      open: true,
      eventId: null,
      lockEvent: false
    });
  });

  it('wires the store to the open/close helpers', () => {
    const store = readFileSync(resolve(process.cwd(), 'app/stores/add-concert-sheet.ts'), 'utf8');
    expect(store).toMatch(/openAddConcertSheetState/);
    expect(store).toMatch(/closedAddConcertSheetState/);
  });

  it('keeps the Add draft when choice cancel does not close the sheet', () => {
    const sheet = readFileSync(resolve(process.cwd(), 'app/components/AppAddConcertSheet.vue'), 'utf8');
    expect(sheet).toMatch(/pendingChoice/);
    expect(sheet).toMatch(/label="Cancel"|label='Cancel'/);
    expect(sheet).toMatch(/pendingChoice\.value = false/);
    expect(sheet).not.toMatch(/dismissChoice[\s\S]{0,80}closeSheet/);
  });

  it('saves without an Event by sending Place and omitting eventId', () => {
    const sheet = readFileSync(resolve(process.cwd(), 'app/components/AppAddConcertSheet.vue'), 'utf8');
    expect(sheet).toMatch(/isTransparent/);
    expect(sheet).toMatch(/v-if="isTransparent"/);
    expect(sheet).toMatch(/place: place\.value/);
    expect(sheet).toMatch(/if \(!picker\.value\)/);
    expect(sheet).toMatch(/if \(!sheet\.eventId\)/);
  });
});
