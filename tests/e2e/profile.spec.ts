import { expect, test } from './fixtures/auth.fixture';
import { OAUTH_GRANTS_EMPTY, OAUTH_GRANTS_HELPER } from '../../shared/domain/oauth-grants';
import { SHARED_LIST_HELPER } from '../../shared/domain/shared-list';
import { waitForNuxtHydration } from './helpers/wait-for-hydration';

test('Profile groups Account, sharing, connected clients, and the assistant into explained cards', async ({
  authenticatedPage,
  account
}) => {
  await authenticatedPage.goto('/profile');
  await waitForNuxtHydration(authenticatedPage);

  const accountCard = authenticatedPage.getByRole('region', { name: 'Account' });
  await expect(accountCard).toBeVisible();
  await expect(accountCard.getByTestId('profile-username')).toHaveText(account.username);
  await expect(accountCard.getByRole('button', { name: 'Sign out' })).toBeVisible();

  const sharing = authenticatedPage.getByRole('region', { name: 'Share with friends' });
  await expect(sharing.getByText(SHARED_LIST_HELPER)).toBeVisible();
  const sharingSwitch = sharing.getByRole('switch', { name: 'Shared list' });
  await expect(sharingSwitch).toBeVisible();
  await expect(sharing.getByText('Off. Your list is private.')).toBeVisible();
  await sharingSwitch.click();
  await expect(sharing.getByText('On. Anyone with the link can see your list.')).toBeVisible();
  await expect(sharing.getByTestId('shared-list-url')).toHaveText(new RegExp(`/u/${account.username}$`));
  await expect(sharing.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await sharingSwitch.click();
  await expect(sharing.getByRole('button', { name: 'Copy link' })).toHaveCount(0);

  const clients = authenticatedPage.getByRole('region', { name: 'Connected clients' });
  await expect(clients.getByText(OAUTH_GRANTS_HELPER)).toBeVisible();
  await expect(clients.getByTestId('oauth-grants-empty')).toHaveText(OAUTH_GRANTS_EMPTY);

  const assistant = authenticatedPage.getByRole('region', { name: 'Cursor assistant' });
  await expect(assistant.getByText(/open the assistant from the menu/)).toBeVisible();
  await expect(assistant.getByTestId('agent-connection-key')).toBeVisible();
  const connect = assistant.getByTestId('agent-connection-connect');
  await expect(connect).toBeDisabled();
  await expect(connect).toHaveClass(/rounded-full/);
  await expect(connect).toHaveClass(/h-11/);

  const signOutBox = await accountCard.getByRole('button', { name: 'Sign out' }).boundingBox();
  expect(signOutBox?.height ?? 0).toBeGreaterThanOrEqual(44);
});
