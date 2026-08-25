import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/deploy-migrations.yml'),
  'utf8'
);

describe('deploy-migrations workflow', () => {
  it('pushes hosted schema from SUPABASE_DB_URL on main', () => {
    expect(workflow).toMatch(/branches:\s*\[main\]/);
    expect(workflow).toContain('supabase/migrations/**');
    expect(workflow).toContain('secrets.SUPABASE_DB_URL');
    expect(workflow).toContain('supabase db push --yes --db-url "$SUPABASE_DB_URL"');
  });
});
