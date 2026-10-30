import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  diagnostics,
  rank,
  score,
  Title,
  Watchlist,
} from '../packages/domain/src/index.js';
const config = (patch: Partial<Watchlist> = {}): Watchlist =>
  Watchlist.parse({
    id: randomUUID(),
    name: 'Test',
    baseline: 6.6,
    top_n: 2,
    tags: [{ name: 'Action', weight: 1 }],
    ...patch,
  });
function title(
  id: number,
  year: number | null,
  rating: number,
  votes: number,
  genres = ['Action'],
): Title {
  return Title.parse({
    imdb_id: `tt${id}`,
    title_type: 'movie',
    name: `Story ${id}`,
    original_year: year,
    parent_series_imdb_id: null,
    series_name: null,
    season: null,
    episode_number: null,
    average_rating: rating,
    num_votes: votes,
    genres,
    provenance: 'imdb',
  });
}
describe('original scoring and selection semantics', () => {
  it('preserves linear votes, relevance, and negative scores', () => {
    expect(score(1000000, 8.8, 6.6, 0.2)).toBeCloseTo(440000);
    expect(score(1000000, 8.8, 6.6)).toBeCloseTo(2200000);
    expect(score(300000, 3.5, 6.6)).toBeCloseTo(-930000);
  });
  it('selects by score before chronological presentation', () => {
    const titles = [
      title(1000001, 1950, 8, 10),
      title(1000002, 2000, 8, 10000),
      title(1000003, 1980, 9, 1000),
    ];
    expect(rank(titles, config()).items.map((t) => t.imdb_id)).toEqual([
      'tt1000003',
      'tt1000002',
    ]);
  });
  it('uses max matching weight, excludes unmatched and zero-weight titles', () => {
    const titles = [
      title(1000001, 2000, 8, 1000, ['Action', 'Drama']),
      title(1000002, 1990, 9, 1000, ['Comedy']),
    ];
    const r = rank(
      titles,
      config({
        tags: [
          { name: 'Action', weight: 0.2 },
          { name: 'Drama', weight: 0.5 },
        ],
      }),
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.relevance).toBe(0.5);
    expect(
      rank(titles, config({ tags: [{ name: 'Action', weight: 0 }] })).items,
    ).toHaveLength(0);
  });
  it('uses stable year ties and places unknown years last', () => {
    const titles = [
      title(1000003, null, 8, 100),
      title(1000002, 2000, 8, 100),
      title(1000001, 2000, 8, 100),
    ];
    expect(
      rank(titles, config({ top_n: 10 })).items.map((t) => t.imdb_id),
    ).toEqual(['tt1000001', 'tt1000002', 'tt1000003']);
  });
  it('distinguishes top N then hide from top N unwatched', () => {
    const titles = [
      title(1000001, 2000, 9, 1000),
      title(1000002, 1990, 8, 1000),
    ];
    const states = [
      {
        imdb_id: 'tt1000001',
        watched_at: '2026-10-30T00:00:00.000Z',
        hidden: false,
        personal_rating: null,
        notes: '',
      },
    ];
    expect(
      rank(titles, config({ top_n: 1, watched_policy: 'hideAfter' }), states)
        .items,
    ).toHaveLength(0);
    expect(
      rank(
        titles,
        config({ top_n: 1, watched_policy: 'unwatchedFirst' }),
        states,
      ).items[0]?.imdb_id,
    ).toBe('tt1000002');
  });
  it('keeps worst relevance semantics explicit', () => {
    const titles = [title(1000001, 2000, 3, 1000)];
    expect(
      rank(
        titles,
        config({ mode: 'worst', tags: [{ name: 'Action', weight: 0.2 }] }),
      ).items[0]?.score,
    ).toBeCloseTo(-720);
    expect(
      rank(
        titles,
        config({
          mode: 'worst',
          worst_relevance: 'filterOnly',
          tags: [{ name: 'Action', weight: 0.2 }],
        }),
      ).items[0]?.score,
    ).toBeCloseTo(-3600);
  });
  it('rejects malformed external watchlists', () => {
    expect(() => config({ baseline: NaN })).toThrow();
    expect(() => config({ tags: [{ name: 'Action', weight: -1 }] })).toThrow();
  });
  it('computes distinct baselines over movies and episodes, excluding optional TV movies', () => {
    const titles = [
      title(1000001, 2000, 8, 100),
      title(1000002, 2000, 4, 300),
      Title.parse({
        ...title(1000003, 2000, 10, 10000),
        title_type: 'tvMovie',
      }),
    ];
    expect(diagnostics(titles).count).toBe(2);
    expect(diagnostics(titles).titleMean).toBe(6);
    expect(diagnostics(titles).voteMean).toBe(5);
  });
});
