import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { concertRefsForLastNight, concertRefsForSouvenirs, selectLastNightEvent, souvenirStats } from '../../shared/domain/home';
import { selectFeaturedEvents, type EventRecord } from '../../shared/domain/events';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const eventAt = (
  id: string,
  name: string,
  start: string,
  kind: EventRecord['kind'] = 'single_night',
  end = start
): EventRecord => ({
  id,
  owner_id: 'owner-1',
  kind,
  name,
  start_date: start,
  end_date: end,
  place: 'Paris'
});

const concertAt = (
  id: string,
  eventId: string,
  date: string,
  time: string | null = null
) => ({
  id,
  event_id: eventId,
  date,
  time
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

describe('selectLastNightEvent', () => {
  const night = eventAt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Past Night', '2026-08-10');
  const festival = eventAt(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Rock Week',
    '2026-08-08',
    'festival',
    '2026-08-10'
  );
  const joined = eventAt('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Joined Night', '2026-08-12');
  const upcomingFestival = eventAt(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'Live Week',
    '2026-08-19',
    'festival',
    '2026-08-21'
  );

  it('hides Last night when nothing is effectively attended', () => {
    expect(selectLastNightEvent(
      [night],
      [concertAt('c-night', night.id, night.start_date)],
      {}
    )).toBeNull();
  });

  it('returns the compact one-Concert Event for a single attended night', () => {
    expect(selectLastNightEvent(
      [night],
      [concertAt('c-night', night.id, night.start_date, '20:00')],
      { 'c-night': 'attended' }
    )).toEqual(night);
  });

  it('returns the whole grouped Event when one Bill Concert is attended', () => {
    const dayOne = concertAt('c-fest-1', festival.id, '2026-08-08', '22:00');
    const dayTwo = concertAt('c-fest-2', festival.id, '2026-08-10', '21:00');

    expect(selectLastNightEvent(
      [festival],
      [dayOne, dayTwo],
      { 'c-fest-2': 'attended' }
    )).toEqual(festival);
  });

  it('returns a joined Event when that is the most recent attended', () => {
    expect(selectLastNightEvent(
      [night, joined],
      [
        concertAt('c-owned', night.id, night.start_date, '20:00'),
        concertAt('c-joined', joined.id, joined.start_date, '21:00')
      ],
      {
        'c-owned': 'attended',
        'c-joined': 'attended'
      }
    )).toEqual(joined);
  });

  it('treats effective attended (past going) as eligible and skips unset Bill-only', () => {
    const goingNight = eventAt('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Effective Night', '2026-08-11');
    const billOnly = concertAt('c-bill', night.id, night.start_date, '23:00');
    const effective = concertAt('c-effective', goingNight.id, goingNight.start_date, '18:00');

    expect(selectLastNightEvent(
      [night, goingNight],
      [billOnly, effective],
      { 'c-effective': 'attended' }
    )).toEqual(goingNight);

    expect(selectLastNightEvent(
      [night],
      [billOnly],
      { 'c-bill': 'going' }
    )).toBeNull();
  });

  it('ranks same-date attended Concerts by later clock time, untimed as 99:99, then id', () => {
    const early = concertAt('c-early', night.id, '2026-08-10', '20:00');
    const late = concertAt('c-late', joined.id, '2026-08-10', '22:00');
    const untimed = concertAt('c-untimed', festival.id, '2026-08-10');

    expect(selectLastNightEvent(
      [night, joined],
      [early, late],
      {
        'c-early': 'attended',
        'c-late': 'attended'
      }
    )).toEqual(joined);

    expect(selectLastNightEvent(
      [night, festival],
      [late, untimed],
      {
        'c-late': 'attended',
        'c-untimed': 'attended'
      }
    )).toEqual(festival);

    const lowerId = concertAt('aaaaaaaa-concert-low', night.id, '2026-08-10', '21:00');
    const higherId = concertAt('zzzzzzzz-concert-high', joined.id, '2026-08-10', '21:00');
    expect(selectLastNightEvent(
      [night, joined],
      [lowerId, higherId],
      {
        [lowerId.id]: 'attended',
        [higherId.id]: 'attended'
      }
    )).toEqual(joined);
  });

  it('skips an attended Concert whose Event is missing and takes the next winner', () => {
    expect(selectLastNightEvent(
      [night],
      [
        concertAt('c-orphan', 'ffffffff-ffff-4fff-8fff-ffffffffffff', '2026-08-15', '23:00'),
        concertAt('c-night', night.id, night.start_date, '20:00')
      ],
      {
        'c-orphan': 'attended',
        'c-night': 'attended'
      }
    )).toEqual(night);
  });

  it('can select an upcoming festival that is also featured', () => {
    const pastDay = concertAt('c-live-1', upcomingFestival.id, '2026-08-19', '10:00');
    const laterDay = concertAt('c-live-2', upcomingFestival.id, '2026-08-21', '21:00');
    const now = new Date('2026-08-19T12:00:00Z');

    expect(selectLastNightEvent(
      [upcomingFestival],
      [pastDay, laterDay],
      { 'c-live-1': 'attended' }
    )).toEqual(upcomingFestival);
    expect(selectFeaturedEvents([upcomingFestival], now).map(event => event.id)).toEqual([
      upcomingFestival.id
    ]);
  });

  it('ranks from the index-plus-loaded union so a truncated window still finds the winner', () => {
    const indexedOnly = concertAt('c-index', night.id, '2026-08-15', '21:00');
    const loadedOnly = concertAt('c-loaded', joined.id, '2026-08-12', '20:00');
    const windowed = concertAt('c-window', festival.id, '2026-08-01', '18:00');

    expect(concertRefsForLastNight([], [loadedOnly])).toEqual([loadedOnly]);
    expect(concertRefsForLastNight([indexedOnly], [])).toEqual([indexedOnly]);
    expect(concertRefsForLastNight(
      [concertAt('c-same', night.id, '2026-08-01', '10:00')],
      [concertAt('c-same', night.id, '2026-08-10', '22:00')]
    )).toEqual([concertAt('c-same', night.id, '2026-08-10', '22:00')]);

    expect(selectLastNightEvent(
      [night, joined, festival],
      concertRefsForLastNight([indexedOnly, windowed], [windowed]),
      {
        'c-index': 'attended',
        'c-window': 'attended'
      }
    )).toEqual(night);

    expect(selectLastNightEvent(
      [night, joined],
      concertRefsForLastNight([], [loadedOnly]),
      { 'c-loaded': 'attended' }
    )).toEqual(joined);
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
    expect(store).toMatch(/concertRefsForLastNight/);
    expect(store).toMatch(/listConcertEventIds/);
    expect(store).toMatch(/concertEventIndex/);
    expect(store).toMatch(/lastNightEvent/);
    expect(store).toMatch(/selectLastNightEvent/);
    expect(store).toMatch(/ensureLastNightBillLoaded/);
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
    const lastNightIndex = home.indexOf('home-last-night');
    const statsIndex = home.indexOf('home-stats');
    expect(errorIndex).toBeGreaterThan(-1);
    expect(emptyIndex).toBeGreaterThan(errorIndex);
    expect(lastNightIndex).toBeGreaterThan(emptyIndex);
    expect(statsIndex).toBeGreaterThan(lastNightIndex);

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
    expect(home).toMatch(/Last night/);
    expect(home).toMatch(/data-testid="home-last-night"/);
    expect(home).toMatch(/lastNightEvent/);
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

  it('places Last night between Coming up and souvenirs without featured or window ranking', () => {
    const home = read('app/pages/home.vue');
    const featuredIndex = home.indexOf('home-featured');
    const lastNightIndex = home.indexOf('home-last-night');
    const statsIndex = home.indexOf('home-stats');
    expect(featuredIndex).toBeGreaterThan(-1);
    expect(lastNightIndex).toBeGreaterThan(featuredIndex);
    expect(statsIndex).toBeGreaterThan(lastNightIndex);

    const lastNight = home.slice(lastNightIndex, statsIndex);
    expect(lastNight).toMatch(/Last night/);
    expect(lastNight).toMatch(/aria-labelledby="home-last-night-heading"/);
    expect(lastNight).toMatch(/id="home-last-night-heading"/);
    expect(lastNight).toMatch(/text-xs font-semibold uppercase tracking-\[0\.08em\] text-muted/);
    expect(lastNight).toMatch(/AppEventCard/);
    expect(lastNight).toMatch(/concertsForEvent/);
    expect(lastNight).not.toMatch(/featured/);
    expect(lastNight).not.toMatch(/visibleEvents/);
    expect(lastNight).not.toMatch(/justify-between/);

    const stats = home.slice(statsIndex);
    expect(stats).not.toMatch(/NuxtLink|<a |@click|to="/);

    const store = read('app/stores/events.ts');
    const lastNightComputed = store.slice(
      store.indexOf('const lastNightEvent'),
      store.indexOf('const ensureLastNightBillLoaded')
    );
    expect(lastNightComputed).toMatch(/selectLastNightEvent/);
    expect(lastNightComputed).toMatch(/concertRefsForLastNight/);
    expect(lastNightComputed).toMatch(/concertEventIndex/);
    expect(lastNightComputed).toMatch(/concerts\.value/);
    expect(lastNightComputed).not.toMatch(/visibleEvents/);

    const ensureBill = store.slice(
      store.indexOf('const ensureLastNightBillLoaded'),
      store.indexOf('const fetchEvents')
    );
    expect(ensureBill).toMatch(/listConcertsForEventIds/);
    expect(ensureBill).toMatch(/incoming\.length === 0/);
    expect(ensureBill).toMatch(/unionForEvent/);

    const fetchEvents = store.slice(store.indexOf('const fetchEvents ='), store.indexOf('const fetchEvent ='));
    const afterAttendance = fetchEvents.slice(fetchEvents.indexOf('listedAttendanceError'));
    expect(afterAttendance).toMatch(/ensureLastNightBillLoaded/);

    const cycleAttendance = store.slice(
      store.indexOf('const cycleAttendance ='),
      store.indexOf('const attendThisNight =')
    );
    expect(cycleAttendance).toMatch(/ensureLastNightBillLoaded/);
    expect(cycleAttendance).toMatch(/attendanceError\.value = lastNightBillError/);

    const attendThisNight = store.slice(
      store.indexOf('const attendThisNight ='),
      store.indexOf('const cycleEventGoing =')
    );
    expect(attendThisNight).toMatch(/ensureLastNightBillLoaded/);

    const cycleEventGoing = store.slice(store.indexOf('const cycleEventGoing ='));
    expect(cycleEventGoing).toMatch(/ensureLastNightBillLoaded/);

    const concerts = read('shared/domain/concerts.ts');
    const indexFn = concerts.slice(concerts.indexOf('export const listConcertEventIds'));
    expect(indexFn).toMatch(/select\('id, event_id, date, time'\)/);
    expect(indexFn).toMatch(/trim\(\)/);
  });
});
