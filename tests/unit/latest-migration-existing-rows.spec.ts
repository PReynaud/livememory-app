import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = readFileSync(
  resolve(process.cwd(), 'scripts/check-latest-migration-on-existing-data.mjs'),
  'utf8'
);
const fixture = readFileSync(
  resolve(process.cwd(), 'supabase/tests/existing-rows.sql'),
  'utf8'
);
const pkg = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
) as { scripts: Record<string, string> };

describe('latest migration on existing rows', () => {
  it('is wired as db:check-latest-migration', () => {
    expect(pkg.scripts['db:check-latest-migration']).toBe(
      'node scripts/check-latest-migration-on-existing-data.mjs'
    );
  });

  it('resets through the previous version then applies pending migrations', () => {
    expect(script).toContain('[\'db\', \'reset\', \'--local\', \'--no-seed\', \'--yes\', \'--version\', previousVersion]');
    expect(script).toContain('[\'migration\', \'up\', \'--local\', \'--yes\']');
    expect(script).toContain('supabase/tests/existing-rows.sql');
  });

  it('inserts a timed concert with a stage so backfills are not a no-op', () => {
    expect(fixture).toContain('public.concerts');
    expect(fixture).toContain('public.event_stages');
    expect(fixture).toContain('\'20:00\'');
    expect(fixture).toContain('stage_id');
  });
});
