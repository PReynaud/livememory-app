import { defineEventHandler, setResponseHeader, setResponseStatus } from 'h3';

export default defineEventHandler((event) => {
  setResponseStatus(event, 404);
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { error: 'not_found' };
});
