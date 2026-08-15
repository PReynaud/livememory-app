import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('app.config.ts', () => {
  it('imports defineAppConfig because auto-imports are disabled', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/app.config.ts'), 'utf8');

    expect(source).toMatch(/import \{ defineAppConfig \} from '#imports'/);
  });
});
