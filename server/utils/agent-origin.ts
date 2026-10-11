export const trustedAgentOrigins = (requestOrigin: string, configuredOrigin: string) =>
  new Set([requestOrigin, configuredOrigin].filter(Boolean));
