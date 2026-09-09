export type DomainError = {
  ruleId: string;
  message: string;
  conflicts?: Array<{
    concertId: string;
    artist: string;
    date: string;
    ruleId: string;
    message: string;
  }>;
};

export type DomainResult<T> = {
  data: T | null;
  error: DomainError | null;
};

export const fail = <T>(ruleId: string, message: string): DomainResult<T> => ({
  data: null,
  error: { ruleId, message }
});

export const ok = <T>(data: T): DomainResult<T> => ({
  data,
  error: null
});
