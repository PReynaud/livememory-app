import { describe, expect, it } from 'vitest';
import {
  getOwnProfile,
  PROFILE_RULE,
  PROFILE_RULE_MESSAGE,
  setSharedListEnabled,
  type ProfileRecord,
  type ProfilesClient
} from '../../shared/domain/profiles';

const pierre: ProfileRecord = {
  username: 'pierre',
  shared_list_enabled: false
};

const createClient = (options?: {
  profile?: ProfileRecord | null;
  getError?: { message: string };
  updateError?: { message: string };
}): ProfilesClient => {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: options?.profile === undefined ? pierre : options.profile,
            error: options?.getError ?? null
          })
        })
      }),
      update: (values: { shared_list_enabled: boolean }) => ({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: {
                username: pierre.username,
                shared_list_enabled: values.shared_list_enabled
              },
              error: options?.updateError ?? null
            })
          })
        })
      })
    })
  };
};

describe('profiles domain', () => {
  it('loads the signed-in username and sharing flag', async () => {
    const result = await getOwnProfile(createClient(), 'user-1');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(pierre);
  });

  it('rejects a missing user or profile row', async () => {
    expect(await getOwnProfile(createClient(), '')).toEqual({
      data: null,
      error: { ruleId: PROFILE_RULE.notFound, message: PROFILE_RULE_MESSAGE.notFound }
    });

    const missing = await getOwnProfile(createClient({ profile: null }), 'user-1');
    expect(missing.error?.ruleId).toBe(PROFILE_RULE.notFound);
  });

  it('persists the Shared List toggle', async () => {
    const result = await setSharedListEnabled(createClient(), 'user-1', true);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      username: 'pierre',
      shared_list_enabled: true
    });
  });

  it('maps persist failures', async () => {
    const result = await setSharedListEnabled(
      createClient({ updateError: { message: 'permission denied' } }),
      'user-1',
      true
    );
    expect(result).toEqual({
      data: null,
      error: { ruleId: PROFILE_RULE.persistFailed, message: 'permission denied' }
    });
  });
});
