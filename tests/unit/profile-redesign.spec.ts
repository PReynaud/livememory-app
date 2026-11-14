import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OAUTH_GRANT_ACCESS,
  OAUTH_GRANT_REVOKE_HELPER,
  OAUTH_GRANTS_HELPER,
  formatGrantConnectedOn
} from '../../shared/domain/oauth-grants';

const profile = readFileSync(resolve(process.cwd(), 'app/pages/profile.vue'), 'utf8');
const template = profile.slice(profile.indexOf('<template>'));

const buttonBlock = (testid: string) => {
  const index = template.indexOf(`data-testid="${testid}"`);
  return template.slice(template.lastIndexOf('<UButton', index), template.indexOf('/>', index));
};

describe('Profile redesign', () => {
  it('groups the page into four titled cards, each with an explanation', () => {
    const headings = ['Account', 'Share with friends', 'Connected clients', 'Cursor assistant'];
    const ids = ['profile-account', 'profile-sharing', 'profile-clients', 'profile-assistant'];

    for (const [index, id] of ids.entries()) {
      const start = template.indexOf(`data-testid="${id}"`);
      const next = ids[index + 1] ? template.indexOf(`data-testid="${ids[index + 1]}"`) : template.length;
      const card = template.slice(template.lastIndexOf('<section', start), next);
      expect(card).toMatch(/class="lm-card p-5 space-y-4"/);
      expect(card).toMatch(/aria-labelledby="profile-\w+-heading"/);
      expect(card).toContain(headings[index]);
      expect(card).toMatch(/<p class="text-\[13px\] text-muted">/);
    }
  });

  it('keeps the Shared list switch, Copy link, revoke, and Cursor key actions wired as before', () => {
    expect(template).toMatch(/label="Shared list"/);
    expect(template).toMatch(/Anyone with the link can see your list\./);
    expect(template).toMatch(/Your list is private\./);
    expect(template).not.toMatch(/On\. Anyone/);
    expect(template).not.toMatch(/Off\. Your list/);
    expect(template).toMatch(/data-testid="shared-list-toggle"/);
    expect(template).toMatch(/persistSharing\(\$event === true\)/);
    expect(template).toMatch(/copySharedListLink\(\)/);
    expect(template).toMatch(/revokeGrant\(grant\.id\)/);
    expect(template).toMatch(/connectCursor\(\)/);
    expect(template).toMatch(/agentChat\.disconnect\(\)/);
    expect(template).toMatch(/v-if="!agentChat\.isReady"/);
  });

  it('draws Disconnect Cursor with the same rounded outline shape as Copy link, Revoke, and Sign out', () => {
    for (const block of [buttonBlock('agent-connection-disconnect'), buttonBlock('oauth-grant-revoke')]) {
      expect(block).toMatch(/variant="outline"/);
      expect(block).toMatch(/h-11/);
      expect(block).toMatch(/rounded-full/);
    }

    const signOut = template.slice(template.indexOf('label="Sign out"'), template.indexOf('/>', template.indexOf('label="Sign out"')));
    expect(signOut).toMatch(/h-11 rounded-full/);
  });

  it('lists each connected client with what it can do, when it was connected, and what Revoke does', () => {
    const clients = template.slice(template.indexOf('data-testid="profile-clients"'), template.indexOf('data-testid="profile-assistant"'));
    expect(clients).toMatch(/<ul[\s\S]*aria-label="Connected clients"/);
    expect(clients).toMatch(/data-testid="oauth-grant"/);
    expect(clients).toMatch(/data-testid="oauth-grant-name"/);
    expect(clients).toMatch(/OAUTH_GRANT_ACCESS/);
    expect(clients).toMatch(/data-testid="oauth-grant-connected-on"/);
    expect(clients).toMatch(/:aria-label="`Revoke \$\{grant\.clientName\}`"/);
    expect(clients).toMatch(/OAUTH_GRANT_REVOKE_HELPER/);
    expect(clients).toMatch(/data-testid="oauth-grants-empty"/);

    expect(OAUTH_GRANTS_HELPER).toMatch(/read and change your concert journal as you/);
    expect(OAUTH_GRANT_ACCESS).toMatch(/Reads and edits/);
    expect(OAUTH_GRANT_REVOKE_HELPER).toMatch(/Nothing in your journal is deleted/);
  });

  it('formats the connection date in Paris time and tolerates bad input', () => {
    expect(formatGrantConnectedOn('2026-11-13T23:30:00Z')).toBe('14 Nov 2026');
    expect(formatGrantConnectedOn('not a date')).toBe('');
  });
});
