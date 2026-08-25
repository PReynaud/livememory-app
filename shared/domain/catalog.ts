export const CATALOG_MIN_QUERY = 3;

export const CATALOG_KIND = {
  artist: 'artist',
  place: 'place',
  stage: 'stage'
} as const;

export type CatalogKind = (typeof CATALOG_KIND)[keyof typeof CATALOG_KIND];

export type CatalogNameRecord = {
  kind: CatalogKind;
  name: string;
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export type CatalogClient = {
  from: (relation: 'name_catalog') => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        like: (column: string, value: string) => {
          order: (column: string, options?: { ascending?: boolean }) => {
            limit: (count: number) => Promise<QueryResult<CatalogNameRecord[]>>;
          };
        };
      };
    };
  };
};

const trim = (value: string | undefined | null) => (value ?? '').trim();

export const catalogPrefixPattern = (query: string): string | null => {
  const needle = trim(query).toLowerCase();
  if (needle.length < CATALOG_MIN_QUERY) {
    return null;
  }

  return `${needle.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
};

export const searchCatalogNames = async (
  client: CatalogClient,
  kind: CatalogKind,
  query: string
): Promise<{ data: string[]; error: string | null }> => {
  const pattern = catalogPrefixPattern(query);
  if (!pattern) {
    return { data: [], error: null };
  }

  const { data, error } = await client
    .from('name_catalog')
    .select('kind,name')
    .eq('kind', kind)
    .like('name_normalized', pattern)
    .order('name', { ascending: true })
    .limit(20);

  if (error) {
    return { data: [], error: error.message };
  }

  return {
    data: (data ?? []).map(row => row.name),
    error: null
  };
};
