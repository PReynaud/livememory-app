import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignoreDirNames = new Set([
  '.git',
  '.nuxt',
  '.output',
  'node_modules',
  'playwright-report',
  'test-results',
  'dist',
  '.temp'
]);

const secretPatterns = [
  { name: 'private-key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'aws-access-key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'generic-secret-assignment', regex: /(?:service_role|SECRET|PRIVATE_KEY)\s*=\s*['"](?!your-|change-me|sk_test)[A-Za-z0-9_\-+/=]{24,}['"]/i }
];

const skipFiles = new Set([
  'playwright.config.ts',
  'tests/e2e/local-supabase.ts',
  'scripts/secret-scan.mjs'
]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (ignoreDirNames.has(entry)) {
      continue;
    }

    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (stat.isFile() && stat.size < 1_000_000) {
      files.push(full);
    }
  }

  return files;
}

const matches = [];

for (const file of walk(root)) {
  const rel = relative(root, file).replaceAll('\\', '/');
  if (skipFiles.has(rel) || rel.endsWith('.png') || rel.endsWith('.ico')) {
    continue;
  }

  const content = readFileSync(file, 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.regex.test(content)) {
      matches.push(`${rel}: ${pattern.name}`);
    }
  }
}

if (matches.length > 0) {
  console.error('Secret scan failed:');
  for (const match of matches) {
    console.error(`  ${match}`);
  }
  process.exit(1);
}

console.log('Secret scan passed.');
