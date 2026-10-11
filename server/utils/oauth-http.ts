import { getRequestURL, setResponseHeader, setResponseStatus } from 'h3';
import type { H3Event } from 'h3';

export const requestOrigin = (event: H3Event) => getRequestURL(event).origin;

export const sendOauthJson = (event: H3Event, status: number, body: unknown) => {
  setResponseStatus(event, status);
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'no-store');
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*');
  return body;
};
