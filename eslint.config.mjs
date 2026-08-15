// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  ignores: [
    'app/types/database.types.ts',
    'supabase/**',
    '_bmad/**',
    '_bmad-output/**',
    '.agents/**'
  ]
});
