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
      { open: false, eventId: null, lockEvent: false, concertId: null },
      { eventId: 'event-1', lockEvent: true }
    );

    expect(locked).toEqual({
      open: true,
      eventId: 'event-1',
      lockEvent: true,
      concertId: null
    });

    expect(openAddConcertSheetState(locked)).toEqual({
      open: true,
      eventId: 'event-1',
      lockEvent: true,
      concertId: null
    });
  });

  it('clears lock when opening from closed without options, and closeSheet clears lock', () => {
    const locked = openAddConcertSheetState(
      { open: false, eventId: null, lockEvent: false, concertId: null },
      { eventId: 'event-1', lockEvent: true }
    );
    const closed = closedAddConcertSheetState();

    expect(closed).toEqual({
      open: false,
      eventId: null,
      lockEvent: false,
      concertId: null
    });
    expect(closed.eventId).not.toBe(locked.eventId);

    expect(openAddConcertSheetState(closed)).toEqual({
      open: true,
      eventId: null,
      lockEvent: false,
      concertId: null
    });
  });

  it('opens edit mode with a concertId and closeSheet clears it', () => {
    const editing = openAddConcertSheetState(
      { open: false, eventId: null, lockEvent: false, concertId: null },
      { eventId: 'event-1', lockEvent: true, concertId: 'concert-1' }
    );

    expect(editing).toEqual({
      open: true,
      eventId: 'event-1',
      lockEvent: true,
      concertId: 'concert-1'
    });
    expect(closedAddConcertSheetState().concertId).toBeNull();
  });

  it('wires the store to the open/close helpers', () => {
    const store = readFileSync(resolve(process.cwd(), 'app/stores/add-concert-sheet.ts'), 'utf8');
    expect(store).toMatch(/openAddConcertSheetState/);
    expect(store).toMatch(/closedAddConcertSheetState/);
    expect(store).toMatch(/concertId/);
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

  it('reuses the glass sheet for edit, notes, and delete without joiner copy', () => {
    const sheet = readFileSync(resolve(process.cwd(), 'app/components/AppAddConcertSheet.vue'), 'utf8');
    expect(sheet).toMatch(/Edit concert/);
    expect(sheet).toMatch(/Private\. Never on your public profile\./);
    expect(sheet).toMatch(/updateOwnedConcert/);
    expect(sheet).toMatch(/deleteOwnedConcert/);
    expect(sheet).toMatch(/Delete this concert\?/);
    expect(sheet).not.toMatch(/joiner/i);
  });

  it('runs Concert identity on edit and keeps the draft for needs_choice', () => {
    const sheet = readFileSync(resolve(process.cwd(), 'app/components/AppAddConcertSheet.vue'), 'utf8');
    const persist = sheet.slice(sheet.indexOf('const persist ='), sheet.indexOf('const dismissChoice ='));
    const editBlock = persist.slice(
      persist.indexOf('updateOwnedConcert'),
      persist.indexOf('createOwnedConcert')
    );

    expect(editBlock).toMatch(/confirm/);
    expect(editBlock).toMatch(/needs_choice/);
    expect(editBlock).toMatch(/pendingChoice\.value = true/);
    expect(editBlock).toMatch(/impossible_place/);
    expect(editBlock).toMatch(/attached/);
    expect(persist).not.toMatch(/dismissChoice[\s\S]{0,80}closeSheet/);
  });

  it('unlocks the owned Event picker in edit so a Concert can move without New night', () => {
    const sheet = readFileSync(resolve(process.cwd(), 'app/components/AppAddConcertSheet.vue'), 'utf8');
    expect(sheet).toMatch(/eventLocked/);
    expect(sheet).toMatch(/!isEdit\.value/);
    expect(sheet).toMatch(/moveOwnedConcert/);
    expect(sheet).toMatch(/originalEventId/);
    expect(sheet).toMatch(/editLoaded/);
    expect(sheet).toMatch(/if \(isEdit\.value\) \{[\s\S]*return owned/);
    expect(sheet).not.toMatch(/joiner/i);
  });

  it('asks for Stage or Scene when the Event has rows and unlocks Place only when override is on', () => {
    const sheet = readFileSync(resolve(process.cwd(), 'app/components/AppAddConcertSheet.vue'), 'utf8');
    expect(sheet).toMatch(/Stage or Scene/);
    expect(sheet).toMatch(/eventAllowsPlaceOverride/);
    expect(sheet).toMatch(/stageId/);
    expect(sheet).toMatch(/showStageSelect/);
  });
});
