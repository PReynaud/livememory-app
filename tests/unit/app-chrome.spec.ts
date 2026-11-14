import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');
const nav = read('app/components/AppGlassNav.vue');
const logo = read('app/components/AppLogo.vue');
const header = read('app/components/AppHeader.vue');
const template = nav.slice(nav.indexOf('<template>'));

describe('Live Pulse app chrome', () => {
  it('marks the active destination with aria-current and the cyan focus colour', () => {
    expect(nav).toMatch(/:aria-current="isActive\(link\.to\) \? 'page' : undefined"/);
    expect(nav).toMatch(/:aria-current="profileActive \? 'page' : undefined"/);
    expect(nav).toMatch(/active \? 'text-\[var\(--focus\)\]'/);
    expect(nav).toMatch(/ring-1 ring-\[var\(--focus\)\]/);
    expect(nav).not.toMatch(/bg-primary/);
    expect(nav).not.toMatch(/'text-primary'/);
  });

  it('keeps four destinations (Home, Concerts, Add, Profile) plus the Ask assistant control', () => {
    const linkTargets = [...template.matchAll(/<NuxtLink\b/g)].length;
    const buttons = [...template.matchAll(/<button\b/g)].length;
    expect(linkTargets).toBe(2);
    expect(buttons).toBe(2);
    expect(nav).toMatch(/to: '\/home', label: 'Home'/);
    expect(nav).toMatch(/to: '\/concerts', label: 'Concerts'/);
    expect(nav).toMatch(/to: '\/home', label: 'Home'[\s\S]*to: '\/concerts'[\s\S]*\] as const/);
    expect(template).toMatch(/aria-label="Add concert"/);
    expect(template).toMatch(/to="\/profile"/);
    expect(nav).not.toMatch(/\/mcp|Settings|Shared list|i-lucide-search|i-lucide-bell/);
  });

  it('opens the assistant from the menu as a button, only when Cursor is ready, and not from Home', () => {
    const assistant = template.slice(template.indexOf('v-if="isAssistantReady"'), template.indexOf('Assistant\n'));
    expect(assistant).toMatch(/<button|type="button"/);
    expect(assistant).toMatch(/aria-label="Ask assistant"/);
    expect(assistant).toMatch(/data-testid="nav-assistant-action"/);
    expect(assistant).toMatch(/@click="agentChat\.open = true"/);
    expect(assistant).not.toMatch(/to="/);
    expect(nav).toMatch(/useAgentChatStore/);

    const home = read('app/pages/home.vue');
    expect(home).not.toMatch(/home-assistant-action|Ask assistant|useAgentChatStore/);
  });

  it('draws Add as a pink outline circle, not a white fill', () => {
    const add = template.slice(template.indexOf('aria-label="Add concert"'), template.indexOf('Add\n'));
    expect(add).toMatch(/border-2 border-primary/);
    expect(add).toMatch(/text-primary/);
    expect(add).not.toMatch(/bg-white|bg-primary/);
  });

  it('shows a decorative rail logo on desktop only', () => {
    expect(template).toMatch(/<span[^>]*class="[^"]*hidden[^"]*lg:flex[^"]*"[^>]*aria-hidden="true"[\s\S]*?<AppLogo/);
  });

  it('draws the logo as equalizer bars in currentColor with a pink bar', () => {
    const bars = [...logo.matchAll(/<rect\b/g)].length;
    expect(bars).toBeGreaterThanOrEqual(4);
    expect(logo).toMatch(/fill="currentColor"/);
    expect(logo).toMatch(/fill="var\(--ui-primary\)"/);
    expect(logo).toMatch(/aria-hidden="true"/);
  });

  it('shows the LiveMemory wordmark in the guest header', () => {
    expect(header).toMatch(/<AppLogo/);
    expect(header).toMatch(/>LiveMemory</);
  });
});
