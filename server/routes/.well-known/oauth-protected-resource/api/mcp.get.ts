import { defineEventHandler } from 'h3';
import { protectedResourceMetadata } from '../../../../utils/oauth';
import { requestOrigin, sendOauthJson } from '../../../../utils/oauth-http';

export default defineEventHandler((event) => {
  return sendOauthJson(event, 200, protectedResourceMetadata(requestOrigin(event)));
});
