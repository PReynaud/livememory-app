import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { concertRefsForSouvenirs, souvenirStats } from '../../shared/domain/home';
import { selectFeaturedEvents, type EventRecord } from '../../shared/domain/events';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const eventAt = (id: string, name: string, start: string): EventRecord => ({
  id,
  owner_id: 'owner-1',
  kind: 'single_night',
  name,
  start_date: start,
  end_date: start,
  place: 'Paris'
});

describe('souvenirStats', () => {
  it('counts attended concerts, participated events, and uncapped upcoming events', () => {
    expect(souvenirStats({
      events: [],
      concerts: [],
      statuses: {}
    })).toEqual({
      attended: 0,
      events: 0,
      going: 0
    });

    const past = eventAt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Past Night', '2026-08-10');
    const upcomingA = eventAt('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Soon A', '2026-12-01');
    const upcomingB = eventAt('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Soon B', '2026-12-08');
    const upcomingC = eventAt('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Soon C', '2026-12-15');
    const upcomingD = eventAt('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Soon D', '2026-12-22');

    expect(souvenirStats({
      events: [past, upcomingA, upcomingB, upcomingC, upcomingD],
      concerts: [
        { id: 'c-past-1', event_id: past.id },
        { id: 'c-past-2', event_id: past.id },
        { id: 'c-soon', event_id: upcomingA.id }
      ],
      statuses: {
        'c-past-1': 'attended',
        'c-past-2': 'attended',
        'c-soon': 'going'
      },
      now: new Date('2026-08-19T12:00:00Z')
    })).toEqual({
      attended: 2,
      events: 1,
      going: 4
    });
  });

  it('counts a Paris-today Event as Upcoming and participated Events from indexed concerts', () => {
    const past = eventAt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Past Night', '2026-08-10');
    const todayNight = eventAt('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Tonight', '2026-08-19');
    const now = new Date('2026-08-19T12:00:00Z');

    expect(souvenirStats({
      events: [past, todayNight],
      concerts: [
        { id: 'c-past', event_id: past.id },
        { id: 'c-today', event_id: todayNight.id }
      ],
      statuses: {
        'c-past': 'attended',
        'c-today': 'going'
      },
      now
    })).toEqual({
      attended: 1,
      events: 1,
      going: 1
    });

    expect(concertRefsForSouvenirs(
      [{ id: 'c-past', event_id: past.id }],
      [{ id: 'c-today', event_id: todayNight.id }]
    )).toEqual([
      { id: 'c-past', event_id: past.id },
      { id: 'c-today', event_id: todayNight.id }
    ]);
  });
});

describe('past Events leave featured without a How was it interstitial', () => {
  it('drops Events whose start date is past and Home has no interstitial copy', () => {
    const past = eventAt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Past Going Night', '2026-08-10');
    const upcoming = eventAt('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Still Upcoming', '2026-12-01');
    const now = new Date('2026-08-19T12:00:00Z');

    expect(selectFeaturedEvents([past, upcoming], now).map(event => event.name)).toEqual(['Still Upcoming']);

    const home = read('app/pages/home.vue');
    expect(home).not.toMatch(/How was it\?/);
  });
});

describe('Home featured and stats surfaces', () => {
  it('fetches through the store, caps featured, and keeps stats non-tappable', () => {
    const home = read('app/pages/home.vue');
    expect(home).toMatch(/fetchEvents/);
    expect(home).toMatch(/featuredEvents/);
    expect(home).toMatch(/homeStats/);
    expect(home).toMatch(/AppEventCard/);
    expect(home).toMatch(/featured/);
    expect(home).toMatch(/Nothing upcoming\./);
    expect(home).toMatch(/Add a night or a concert\./);
    expect(home).toMatch(/openSheet|openAddSheet/);
    expect(home).toMatch(/data-testid="home-stats"/);
    expect(home).toMatch(/data-stat="attended"/);
    expect(home).toMatch(/data-stat="events"/);
    expect(home).toMatch(/data-stat="going"/);
    expect(home).not.toMatch(/v-for="event in events"/);
    expect(home).not.toMatch(/for you|Pour vous|album/i);
    expect(home).not.toMatch(/<NuxtLink/);
    expect(home).not.toMatch(/<svg/);
    const stats = home.slice(home.indexOf('home-stats'));
    expect(stats).not.toMatch(/NuxtLink|<a |@click|to="/);
    expect(stats).not.toMatch(/#FF4D8A|text-primary|text-going/);

    const store = read('app/stores/events.ts');
    expect(store).toMatch(/selectFeaturedEvents/);
    expect(store).toMatch(/souvenirStats/);
    expect(store).toMatch(/featuredEvents/);
    expect(store).toMatch(/homeStats/);
    expect(store).toMatch(/concertRefsForSouvenirs/);
    expect(store).toMatch(/listConcertEventIds/);
    expect(store).toMatch(/concertEventIndex/);
    expect(store).toMatch(/statuses: attendanceByConcertId\.value/);
    expect(store).not.toMatch(/eventCount:/);
    expect(store).not.toMatch(/from\('attendance'\)/);
    expect(store).not.toMatch(/from\('attendance_effective'\)/);
  });

  it('shows Couldn\'t load with Retry on fetch failure instead of empty featured copy', () => {
    const home = read('app/pages/home.vue');
    expect(home).toMatch(/AppLoadError/);
    expect(home).toMatch(/retryLoad/);
    expect(home).toMatch(/data-testid="home-load-error"|testid="home-load-error"/);

    const errorComponent = read('app/components/AppLoadError.vue');
    expect(errorComponent).toMatch(/Couldn't load\./);
    expect(errorComponent).toMatch(/label="Retry"/);

    const errorIndex = home.indexOf('AppLoadError');
    const emptyIndex = home.indexOf('home-featured-empty');
    const statsIndex = home.indexOf('home-stats');
    expect(errorIndex).toBeGreaterThan(-1);
    expect(emptyIndex).toBeGreaterThan(errorIndex);
    expect(statsIndex).toBeGreaterThan(emptyIndex);

    const beforeEmpty = home.slice(0, emptyIndex);
    expect(beforeEmpty).toMatch(/error/);
    expect(beforeEmpty).toMatch(/v-else/);
    expect(beforeEmpty).not.toMatch(/Add concert/);
  });

  it('propagates attendance list failure through fetchEvents so Home does not show zero stats', () => {
    const store = read('app/stores/events.ts');
    const fetchEvents = store.slice(store.indexOf('const fetchEvents ='), store.indexOf('const fetchEvent ='));
    expect(fetchEvents).toMatch(/listedAttendanceError/);
    expect(fetchEvents).toMatch(/if \(listedAttendanceError\)/);
    expect(fetchEvents).toMatch(/error\.value = listedAttendanceError/);
    expect(fetchEvents).toMatch(/return \{ data: events\.value, error: listedAttendanceError \}/);

    const home = read('app/pages/home.vue');
    const statsIndex = home.indexOf('home-stats');
    const beforeStats = home.slice(0, statsIndex);
    expect(beforeStats).toMatch(/error/);
    expect(beforeStats).toMatch(/v-else/);
    expect(beforeStats).toMatch(/AppLoadError/);
  });

  it('uses display-sm on featured compact artist and grouped Event name', () => {
    const card = read('app/components/AppEventCard.vue');
    expect(card).toMatch(/isCompactBill/);
    expect(card).toMatch(/formatConcertMetaLine/);
    expect(card).toMatch(/groupConcertsByDate/);
    expect(card).toMatch(/cycleAttendance/);
    expect(card).toMatch(/cycleEventGoing/);
    expect(card).toMatch(/data-event-card/);
    expect(card).toMatch(/data-featured/);
    expect(card).toMatch(/text-2xl font-bold tracking-tight leading-\[1\.15\]/);
    expect(card).toMatch(/text-base font-semibold/);
    expect(card).toMatch(/eventPath/);
    expect(card).toMatch(/`\/e\/\$\{props\.event\.id\}`/);
    expect(card).not.toMatch(/for you|Pour vous|album/i);
  });

  it('renders Coming up header, count, muted lead, souvenirs, and empty journal chrome', () => {
    const home = read('app/pages/home.vue');
    expect(home).toMatch(/Coming up/);
    expect(home).toMatch(/Your journal/);
    expect(home).toMatch(/Your souvenirs/);
    expect(home).toMatch(/Upcoming/);
    expect(home).toMatch(/home-souvenirs-heading/);
    expect(home).toMatch(/is waiting\./);
    expect(home).toMatch(/are waiting\./);
    expect(home).toMatch(/isCompactBill/);
    expect(home).toMatch(/featuredEvents\.length/);
    expect(home).toMatch(/UIcon/);
    expect(home).toMatch(/i-lucide-music/);
    expect(home).toMatch(/border-l/);
    expect(home).toMatch(/max-w-3xl/);
    expect(home).not.toMatch(/max-w-lg/);
    expect(home).not.toMatch(/card-spotlight/);
    expect(home).not.toMatch(/How was it\?/);
    expect(home).not.toMatch(/for you|Pour vous|album/i);

    const card = read('app/components/AppEventCard.vue');
    expect(card).toMatch(/lm-card|border-\[#2E2E2E\]/);
    expect(card).toMatch(/lm-concert-row|--well/);
    expect(card).not.toMatch(/card-spotlight/);
    expect(card).not.toMatch(/py-1\.5/);
  });
});
