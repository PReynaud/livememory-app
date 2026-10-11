import { fail, ok, type DomainResult } from './result';

export type OauthGrantListItem = {
  id: string;
  clientName: string;
  createdAt: string;
};

export type OauthClientName = {
  id: string;
  clientName: string;
};

export const OAUTH_GRANT_COLUMNS = 'id, client_id, created_at, oauth_clients(client_name)';
export const OAUTH_CLIENT_COLUMNS = 'id, client_name';
export const OAUTH_GRANTS_HELPER = 'Clients you allow can act as you until you revoke them.';
export const OAUTH_GRANTS_EMPTY = 'No connected clients.';

type QueryError = {
  message: string;
};

type QueryResult<T> = {
  data: T | null;
  error: QueryError | null;
};

type GrantQueryRow = {
  id: string;
  client_id: string;
  created_at: string;
  oauth_clients: { client_name: string } | { client_name: string }[] | null;
};

type ClientQueryRow = {
  id: string;
  client_name: string;
};

type GrantQuery = {
  eq: (column: string, value: string | boolean) => GrantQuery;
  order: (
    column: string,
    options: { ascending: boolean }
  ) => PromiseLike<QueryResult<GrantQueryRow[]>>;
  maybeSingle: () => PromiseLike<QueryResult<ClientQueryRow | null>>;
};

export type OauthDirectoryClient = {
  from: (relation: 'oauth_grants' | 'oauth_clients') => {
    select: (columns: string) => {
      eq: (column: string, value: string | boolean) => GrantQuery;
    };
    delete: () => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => PromiseLike<QueryResult<null>>;
      };
    };
  };
};

const clientNameOf = (
  value: GrantQueryRow['oauth_clients']
) => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row.client_name === 'string' ? row.client_name : '';
};

export const listOauthGrants = async (
  client: OauthDirectoryClient,
  userId: string
): Promise<DomainResult<OauthGrantListItem[]>> => {
  if (!userId) {
    return fail('oauth_grant_failed', 'Profile not found');
  }

  const { data, error } = await client
    .from('oauth_grants')
    .select(OAUTH_GRANT_COLUMNS)
    .eq('user_id', userId)
    .eq('has_access_token', true)
    .order('created_at', { ascending: false });

  if (error) {
    return fail('oauth_grant_failed', error.message);
  }

  const grants = (data ?? []).map(row => ({
    id: row.id,
    clientName: clientNameOf(row.oauth_clients),
    createdAt: row.created_at
  }));

  return ok(grants);
};

export const revokeOauthGrant = async (
  client: OauthDirectoryClient,
  userId: string,
  grantId: string
): Promise<DomainResult<true>> => {
  if (!userId || !grantId) {
    return fail('oauth_grant_failed', 'Profile not found');
  }

  const { error } = await client
    .from('oauth_grants')
    .delete()
    .eq('id', grantId)
    .eq('user_id', userId);

  if (error) {
    return fail('oauth_grant_failed', error.message);
  }

  return ok(true);
};

export const getOauthClient = async (
  client: OauthDirectoryClient,
  clientId: string
): Promise<DomainResult<OauthClientName | null>> => {
  if (!clientId) {
    return fail('oauth_grant_failed', 'This client is not registered.');
  }

  const { data, error } = await client
    .from('oauth_clients')
    .select(OAUTH_CLIENT_COLUMNS)
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    return fail('oauth_grant_failed', error.message);
  }

  if (!data) {
    return ok(null);
  }

  return ok({
    id: data.id,
    clientName: data.client_name
  });
};
