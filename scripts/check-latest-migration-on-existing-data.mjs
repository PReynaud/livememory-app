import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase/migrations');
const fixturePath = join(root, 'supabase/tests/existing-rows.sql');

const versionOf = filename => filename.split('_')[0];

const runSupabase = (args) => {
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  execFileSync(pnpm, ['exec', 'supabase', ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
};

const migrations = readdirSync(migrationsDir)
  .filter(name => name.endsWith('.sql'))
  .sort();

if (migrations.length < 2) {
  console.log('Skipping latest-migration data check (need at least two migrations).');
  process.exit(0);
}

const latest = migrations[migrations.length - 1];
const previousVersion = versionOf(migrations[migrations.length - 2]);

console.log(`Resetting local database through ${previousVersion}, then applying ${latest} on existing rows.`);

runSupabase(['db', 'reset', '--local', '--no-seed', '--yes', '--version', previousVersion]);
runSupabase(['db', 'query', '--local', '-f', fixturePath]);
runSupabase(['migration', 'up', '--local', '--yes']);

console.log(`Latest migration ${latest} applied on existing rows.`);
