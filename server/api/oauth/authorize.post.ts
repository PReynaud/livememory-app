import { createError, defineEventHandler, getRequestHeader, readBody } from 'h3';
import { decideOauthAuthorization } from '../../utils/oauth';
import { createSupabaseOauthStore, readSignedInUserId } from '../../utils/oauth-db';
import { requestOrigin, sendOauthJson } from '../../utils/oauth-http';
import { assertMcpSupabaseEnv } from '../../utils/personal-key-exchange';
import { readMcpSupabaseEnv } from '../../utils/mcp-runtime';

type AuthorizeBody = {
  decision?: unknown;
  client_id?: unknown;
  redirect_uri?: unknown;
  response_type?: unknown;
  code_challenge?: unknown;
  code_challenge_method?: unknown;
  state?: unknown;
  resource?: unknown;
};

const asString = (value: unknown) => typeof value === 'string' ? value : '';

export default defineEventHandler(async (event) => {
  const env = readMcpSupabaseEnv(event);
  assertMcpSupabaseEnv(env);
  const userId = await readSignedInUserId(getRequestHeader(event, 'authorization'), env);
  if (!userId) {
    return sendOauthJson(event, 401, {
      error: 'invalid_request',
      error_description: 'Sign in required.'
    });
  }

  const body = await readBody<AuthorizeBody>(event).catch(() => ({} as AuthorizeBody));
  const decision = body?.decision === 'deny' ? 'deny' : body?.decision === 'allow' ? 'allow' : '';
  if (!decision) {
    return sendOauthJson(event, 400, {
      error: 'invalid_request',
      error_description: 'Choose Allow or Deny.'
    });
  }

  try {
    const result = await decideOauthAuthorization(createSupabaseOauthStore(env), {
      decision,
      userId,
      clientId: asString(body?.client_id),
      redirectUri: asString(body?.redirect_uri),
      responseType: asString(body?.response_type),
      codeChallenge: asString(body?.code_challenge),
      codeChallengeMethod: asString(body?.code_challenge_method),
      state: asString(body?.state),
      resource: asString(body?.resource),
      origin: requestOrigin(event)
    });
    if (!result.ok) {
      return sendOauthJson(event, result.status, result.body);
    }

    return sendOauthJson(event, 200, { redirect: result.redirect });
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Could not complete authorization.'
    });
  }
});
