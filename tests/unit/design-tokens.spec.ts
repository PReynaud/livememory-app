import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, readCssVariable } from './helpers/contrast';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');
const css = read('app/assets/css/main.css');
const going = '#FF4D8A';

describe('Live Pulse tokens', () => {
  it('uses the navy canvas, navy surfaces, and the cyan focus token', () => {
    expect(readCssVariable(css, '--bg')).toBe('#081020');
    expect(readCssVariable(css, '--ui-bg')).toBe('#081020');
    expect(readCssVariable(css, '--surface')).toBe('#111827');
    expect(readCssVariable(css, '--surface-alt')).toBe('#1F2937');
    expect(readCssVariable(css, '--fg')).toBe('#F9FAFB');
    expect(readCssVariable(css, '--muted')).toBe('#9CA3AF');
    expect(readCssVariable(css, '--border')).toBe('#263042');
    expect(readCssVariable(css, '--focus')).toBe('#00D4FF');
    expect(css).toMatch(/--color-going-500:\s*#FF4D8A;/);
    expect(css).toMatch(/--ui-primary:\s*#FF4D8A;/);
  });

  it('keeps text pairs at WCAG AA on the canvas and the card surface', () => {
    const backgrounds = [readCssVariable(css, '--bg'), readCssVariable(css, '--surface')];
    const texts = [readCssVariable(css, '--fg'), readCssVariable(css, '--muted'), going];

    for (const background of backgrounds) {
      for (const text of texts) {
        expect(contrastRatio(text, background), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }

    expect(contrastRatio(going, readCssVariable(css, '--surface-alt'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#000000', going)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the cyan focus ring visible on every surface', () => {
    const focus = readCssVariable(css, '--focus');
    for (const name of ['--bg', '--surface', '--surface-alt']) {
      expect(contrastRatio(focus, readCssVariable(css, name)), name).toBeGreaterThanOrEqual(3);
    }
  });

  it('routes focus rings and the selected list tab through the focus token', () => {
    expect(css).toMatch(/\.dark :focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus\)/);
    expect(css).toMatch(/\.lm-list-tab\[aria-selected="true"\]\s*\{[^}]*border:\s*2px solid var\(--focus\)/);
    expect(css).toMatch(/\.lm-option-chip\[aria-pressed="true"\]\s*\{[^}]*#FF4D8A/);
    expect(css).toMatch(/\.lm-filter-chip\s*\{[^}]*#FF4D8A/);
  });

  it('removes hard-coded black-canvas neutrals from components', () => {
    const files = [
      'app/components/AppAttendanceChip.vue',
      'app/components/AppListSkeleton.vue',
      'app/components/AppGlassNav.vue',
      'app/components/AppEventCard.vue',
      'app/components/AppAiChatSheet.vue',
      'app/pages/e/[id].vue'
    ];

    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(/#1A1A1A|#A3A3A3|#000000|border-white\/8/i);
    }

    const chip = read('app/components/AppAttendanceChip.vue');
    expect(chip).toMatch(/focus-visible:outline-\[var\(--focus\)\]/);
    expect(chip).not.toMatch(/focus-visible:outline-\[#FF4D8A\]/);
  });
});
