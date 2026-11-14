import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');
const page = read('app/pages/e/[id].vue');
const header = page.slice(page.indexOf('<header'), page.indexOf('</header>'));

describe('Event page Live Pulse header', () => {
  it('leads the header with a date stack, the display title, and a pinned place line', () => {
    expect(header).toMatch(/<AppDateStack[\s\S]*:date="currentEvent\.start_date"[\s\S]*:end-date="currentEvent\.end_date"[\s\S]*size="lg"/);
    expect(header).toMatch(/<h1[\s\S]*currentEvent\.name/);
    expect(header).toMatch(/i-lucide-map-pin/);
    expect(header).toMatch(/eventLead/);
    expect(header).toMatch(/Edit event/);
    expect(header).toMatch(/Share event/);
  });

  it('moves the single-night Going chip into the header for every member', () => {
    expect(header).toMatch(/v-if="showNightGoingChip"/);
    expect(header).toMatch(/cycleEventGoing/);
    const bill = page.slice(page.indexOf('aria-labelledby="event-bill-heading"'));
    expect(bill).not.toMatch(/showNightGoingChip/);
  });

  it('styles the header icon actions as 44px targets', () => {
    const css = read('app/assets/css/main.css');
    expect(css).toMatch(/\.lm-header-icon\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/);
  });
});

describe('Event page owner notes', () => {
  it('shows notes only to the owner', () => {
    expect(page).toMatch(/const ownerNotes = computed\(\(\) => \{\s*if \(!isOwner\.value\)/);
    expect(page).toMatch(/v-if="isOwner && compactNote"/);
    expect(page).toMatch(/v-if="isOwner && concert\.notes/);
    expect(page).toMatch(/data-testid="event-notes"/);
    expect(page).toMatch(/My notes/);
  });

  it('collapses festival days and leaves a one-day bill without that control', () => {
    expect(page).toMatch(/canCollapseDays/);
    expect(page).toMatch(/currentEvent\.value\?\.kind === 'festival' && billGroups\.value\.length > 1/);
    expect(page).toMatch(/aria-expanded/);
    expect(page).toMatch(/dayConcertCountLabel/);
    expect(page).toMatch(/v-show="!canCollapseDays \|\| isDayOpen\(group\.date\)"/);
    expect(page).toMatch(/collapsedDays\.value = new Set\(\)/);
    expect(page).toMatch(/collapsedDays = ref\(new Set/);
  });

  it('does not draw held Live Pulse items', () => {
    expect(page).not.toMatch(/Photos|Setlist|friends|Favorite|i-lucide-heart/i);
  });
});
