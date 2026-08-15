import type { Page } from '@playwright/test';

export const waitForNuxtHydration = async (page: Page) => {
  await page.waitForFunction(() => {
    const nuxtRoot = document.querySelector('#__nuxt') as {
      __vue_app__?: unknown;
    } | null;

    return Boolean(nuxtRoot?.__vue_app__);
  });
};
