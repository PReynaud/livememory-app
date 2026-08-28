import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canWriteOnline, OFFLINE_TOAST_TITLE } from '../../app/utils/online-write';
import { surfaceNameForRoute } from '../../app/utils/surface-name';
import { EVENTS_LIST_WINDOW } from '../../shared/domain/concerts';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

describe('surface names', () => {
  it('announces Home, Concerts, Event name, and Profile', () => {
    expect(surfaceNameForRoute('/home')).toBe('Home');
    expect(surfaceNameForRoute('/concerts')).toBe('Concerts');
    expect(surfaceNameForRoute('/profile')).toBe('Profile');
    expect(surfaceNameForRoute('/e/abc', 'Rock Week')).toBe('Event: Rock Week');
    expect(surfaceNameForRoute('/e/abc')).toBe('');
    expect(surfaceNameForRoute('/u/pierre')).toBe('Shared list for pierre');
  });
});

describe('offline writes', () => {
  it('blocks writes when the browser is offline and names the toast', () => {
    expect(OFFLINE_TOAST_TITLE).toBe('You\'re offline.');
    expect(canWriteOnline(true)).toBe(true);
    expect(canWriteOnline(false)).toBe(false);
    expect(canWriteOnline(undefined)).toBe(true);
  });
});

describe('list polish source guards', () => {
  it('uses USkeleton on cold Home, Concerts, and Event loads', () => {
    const home = read('app/pages/home.vue');
    const concerts = read('app/pages/concerts.vue');
    const eventPage = read('app/pages/e/[id].vue');
    const skeleton = read('app/components/AppListSkeleton.vue');

    expect(skeleton).toMatch(/USkeleton/);
    expect(skeleton).toMatch(/home/);
    expect(skeleton).toMatch(/groups/);
    expect(home).toMatch(/AppListSkeleton/);
    expect(home).toMatch(/variant="home"/);
    expect(home).toMatch(/loading/);
    expect(home).toMatch(/import\.meta\.server/);
    expect(concerts).toMatch(/AppListSkeleton/);
    expect(concerts).toMatch(/variant="groups"/);
    expect(concerts).toMatch(/import\.meta\.server/);
    expect(concerts).not.toMatch(/Loading events/);
    expect(eventPage).toMatch(/AppListSkeleton/);
    expect(eventPage).not.toMatch(/Loading event/);
  });

  it('shows Couldn\'t load with Retry on Home, Concerts, and Event', () => {
    const home = read('app/pages/home.vue');
    const concerts = read('app/pages/concerts.vue');
    const eventPage = read('app/pages/e/[id].vue');
    const error = read('app/components/AppLoadError.vue');

    expect(error).toMatch(/Couldn't load\./);
    expect(error).toMatch(/label="Retry"/);
    expect(home).toMatch(/AppLoadError/);
    expect(home).toMatch(/void eventsStore\.fetchEvents\(\)/);
    expect(concerts).toMatch(/AppLoadError/);
    expect(concerts).toMatch(/const retryLoad = \(\) => \{\s*void eventsStore\.fetchEvents\(\);/);
    expect(concerts).not.toMatch(/loadMoreEvents\(\);\s*return;/);
    expect(concerts).not.toMatch(/\{\{\s*error\s*\}\}/);
    expect(concerts).toMatch(/v-else-if="error"/);
    expect(concerts).toMatch(/v-else$/m);
    expect(eventPage).toMatch(/AppLoadError/);
  });

  it('windows Concerts by Event groups with Loading more and no infinite scroll', () => {
    const store = read('app/stores/events.ts');
    const concerts = read('app/pages/concerts.vue');

    expect(EVENTS_LIST_WINDOW).toBe(20);
    expect(store).toMatch(/EVENTS_LIST_WINDOW/);
    expect(store).toMatch(/nextEventsListWindowEnd/);
    expect(store).toMatch(/listConcertsForEventIds/);
    expect(store).toMatch(/loadMoreEvents/);
    expect(store).toMatch(/loadingMore/);
    expect(store).toMatch(/visibleEvents/);
    expect(store).toMatch(/hasMoreEvents/);
    expect(store).not.toMatch(/from\('concerts'\)/);
    expect(concerts).toMatch(/visibleEvents/);
    expect(concerts).toMatch(/loadingMore/);
    expect(concerts).toMatch(/loadMore/);
    expect(concerts).toMatch(/loadMoreEvents/);
    expect(concerts).not.toMatch(/IntersectionObserver|infinite scroll|@scroll/);
    expect(concerts).not.toMatch(/v-for="event in events"/);
  });

  it('uses max-w-3xl on list and Event pages and keeps Profile narrower', () => {
    const home = read('app/pages/home.vue');
    const concerts = read('app/pages/concerts.vue');
    const eventPage = read('app/pages/e/[id].vue');
    const shared = read('app/pages/u/[username].vue');
    const profile = read('app/pages/profile.vue');
    const app = read('app/app.vue');

    expect(home).toMatch(/max-w-3xl/);
    expect(concerts).toMatch(/max-w-3xl/);
    expect(eventPage).toMatch(/max-w-3xl/);
    expect(shared).toMatch(/max-w-3xl/);
    expect(home).not.toMatch(/max-w-lg/);
    expect(concerts).not.toMatch(/max-w-lg/);
    expect(eventPage).not.toMatch(/max-w-lg/);
    expect(shared).not.toMatch(/max-w-lg/);
    expect(profile).toMatch(/max-w-lg/);
    expect(app).toMatch(/chrome-safe/);
  });

  it('announces surfaces, keeps focus rings on black, and drops glow plus blur animation under reduced motion', () => {
    const app = read('app/app.vue');
    const announcer = read('app/components/AppRouteAnnouncer.vue');
    const css = read('app/assets/css/main.css');
    const chip = read('app/components/AppAttendanceChip.vue');
    const nav = read('app/components/AppGlassNav.vue');

    expect(app).toMatch(/AppRouteAnnouncer/);
    expect(announcer).toMatch(/aria-live="polite"/);
    expect(announcer).toMatch(/surfaceNameForRoute/);
    expect(announcer).toMatch(/data-testid="route-announcer"/);
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/#FF4D8A/);
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/lm-card-interactive/);
    expect(css).toMatch(/--glass:/);
    expect(css).toMatch(/--sheet-glass:/);
    expect(css).toMatch(/--panel-glass:/);
    expect(css).toMatch(/--well:/);
    expect(css).toMatch(/--well-glass:/);
    expect(css).toMatch(/-webkit-backdrop-filter/);
    expect(chip).toMatch(/border-dashed border-\[#FF4D8A\]/);
    expect(chip).not.toMatch(/border-dashed border-\[#A3A3A3\]/);
    expect(chip).toMatch(/shadow-\[0_0_8px_#FF4D8A66\]/);
    expect(chip).toMatch(/motion-reduce:shadow-none/);
    expect(chip).toMatch(/motion-reduce:outline/);
    expect(nav).toMatch(/lm-chrome|motion-reduce/);
    expect(nav).toMatch(/--glass|var\(--glass\)/);
    expect(nav).toMatch(/max-w-\[calc\(var\(--max-w\)-24px\)\]/);
    expect(css).toMatch(/--max-w:\s*768px/);
    expect(css).toMatch(/--chrome-safe:\s*88px/);
    expect(css).toMatch(/\.lm-concert-row[\s\S]{0,200}align-items:\s*center/);
  });

  it('blocks offline writes in the store with a toast and no queue', () => {
    const store = read('app/stores/events.ts');
    expect(store).toMatch(/canWriteOnline/);
    expect(store).toMatch(/OFFLINE_TOAST_TITLE/);
    expect(store).toMatch(/toast\.add/);
    expect(store).not.toMatch(/offlineQueue|indexedDB|background-sync/);
    expect(store).toMatch(/createOwnedEvent/);
    expect(store).toMatch(/createOwnedConcert/);
    expect(store).toMatch(/cycleAttendance/);
  });

  it('keeps list actions tappable on small screens, forbids drag-and-drop, and stacks one sheet', () => {
    const concerts = read('app/pages/concerts.vue');
    const eventPage = read('app/pages/e/[id].vue');
    const card = read('app/components/AppEventCard.vue');
    const addSheet = read('app/components/AppAddConcertSheet.vue');
    const editSheet = read('app/components/AppEditEventSheet.vue');

    expect(concerts).not.toMatch(/group-hover:opacity|hover:only|md:hidden[\s\S]*hover:/);
    expect(eventPage).not.toMatch(/draggable|dragstart|vuedraggable/);
    expect(card).not.toMatch(/draggable|dragstart/);
    expect(card).toMatch(/AppAttendanceChip/);
    expect(addSheet).toMatch(/useEditEventSheetStore/);
    expect(addSheet).toMatch(/closeSheet/);
    expect(editSheet).toMatch(/useAddConcertSheetStore/);
    expect(editSheet).toMatch(/closeSheet/);
  });
});
