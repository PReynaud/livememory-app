import { describe, expect, it } from 'vitest';
import {
  CATALOG_KIND,
  catalogPrefixPattern,
  searchCatalogNames,
  type CatalogClient,
  type CatalogNameRecord
} from '../../shared/domain/catalog';

const createMockCatalogClient = (rows: CatalogNameRecord[]): CatalogClient => {
  return {
    from: () => ({
      select: () => ({
        eq: (_column: string, kind: string) => ({
          like: (_likeColumn: string, pattern: string) => ({
            order: () => ({
              limit: async () => ({
                data: rows.filter((row) => {
                  const prefix = pattern.replace(/%$/, '');
                  return row.kind === kind && row.name.toLowerCase().startsWith(prefix);
                }),
                error: null
              })
            })
          })
        })
      })
    })
  };
};

describe('name catalog search', () => {
  it('ignores queries shorter than 3 characters', () => {
    expect(catalogPrefixPattern('')).toBeNull();
    expect(catalogPrefixPattern('ab')).toBeNull();
    expect(catalogPrefixPattern('jus')).toBe('jus%');
  });

  it('returns matching shared artist names', async () => {
    const client = createMockCatalogClient([
      { kind: CATALOG_KIND.artist, name: 'Justice' },
      { kind: CATALOG_KIND.artist, name: 'Just Mustard' },
      { kind: CATALOG_KIND.place, name: 'Paris' }
    ]);

    const empty = await searchCatalogNames(client, CATALOG_KIND.artist, 'ju');
    expect(empty).toEqual({ data: [], error: null });

    const hits = await searchCatalogNames(client, CATALOG_KIND.artist, 'jus');
    expect(hits.error).toBeNull();
    expect(hits.data).toEqual(['Justice', 'Just Mustard']);
  });
});
