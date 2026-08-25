import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/deploy-migrations.yml'),
  'utf8'
);

describe('deploy-migrations workflow', () => {
  it('links the hosted project and pushes migrations on main', () => {
    expect(workflow).toMatch(/branches:\s*\[main\]/);
    expect(workflow).toContain('supabase/migrations/**');
    expect(workflow).toContain('secrets.SUPABASE_ACCESS_TOKEN');
    expect(workflow).toContain('secrets.SUPABASE_DB_PASSWORD');
    expect(workflow).toContain('vars.SUPABASE_PROJECT_ID');
    expect(workflow).toContain('supabase link --project-ref "$SUPABASE_PROJECT_ID"');
    expect(workflow).toContain('supabase db push --yes');
    expect(workflow).not.toContain('--db-url');
  });
});
