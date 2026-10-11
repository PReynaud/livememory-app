import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pnpmPackage = (name: string) => {
  const root = fileURLToPath(new URL('./node_modules/.pnpm', import.meta.url));
  const match = readdirSync(root)
    .filter(entry => entry.startsWith(`${name}@`) && !entry.includes('-rc'))
    .sort()
    .at(-1);
  if (!match) throw new Error(`Cannot resolve ${name} from the pnpm store.`);
  return fileURLToPath(new URL(`./node_modules/.pnpm/${match}/node_modules/${name}`, import.meta.url));
};

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node'
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./app', import.meta.url)),
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '#imports': fileURLToPath(new URL('./tests/unit/helpers/nuxt-imports-stub.ts', import.meta.url)),
      'vue': pnpmPackage('vue'),
      'h3': pnpmPackage('h3')
    }
  }
});
