import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
) as {
  'scripts': Record<string, string>;
  'simple-git-hooks': Record<string, string>;
  'lint-staged': Record<string, string>;
};

describe('pre-commit hook', () => {
  it('installs simple-git-hooks on prepare', () => {
    expect(pkg.scripts.prepare).toBe('simple-git-hooks');
  });

  it('runs eslint --fix on staged JS, TS, and Vue files', () => {
    expect(pkg['simple-git-hooks']['pre-commit']).toBe('pnpm lint-staged');
    expect(pkg['lint-staged']['*.{js,mjs,cjs,ts,mts,vue}']).toBe('eslint --fix');
  });
});
