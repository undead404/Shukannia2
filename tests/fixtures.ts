import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { Watchlist } from '../packages/domain/src/index.js';
export function config(patch: Partial<Watchlist> = {}): Watchlist {
  return Watchlist.parse({
    id: randomUUID(),
    name: 'Sci-Fi',
    baseline: 6.6,
    top_n: 100,
    tags: [
      { name: 'Sci-Fi', weight: 0.2 },
      { name: 'Drama', weight: 0.7 },
    ],
    ...patch,
  });
}
export async function fixture(dir: string) {
  await mkdir(dir, { recursive: true });
  const files = {
    basics:
      'tconst\ttitleType\tprimaryTitle\toriginalTitle\tisAdult\tstartYear\tendYear\truntimeMinutes\tgenres\ntt1000001\tmovie\tNewer movie\tNewer movie\t0\t2000\t\\N\t100\tSci-Fi\ntt1000002\ttvSeries\tParent\tParent\t0\t1970\t\\N\t40\tSci-Fi,Drama\ntt1000003\ttvEpisode\tLone episode\tLone episode\t0\t1980\t\\N\t40\t\\N\ntt1000004\tmovie\tBad movie\tBad movie\t0\t\\N\t\\N\t80\tSci-Fi\n',
    ratings:
      'tconst\taverageRating\tnumVotes\ntt1000001\t8.8\t1000000\ntt1000002\t9.5\t9999999\ntt1000003\t9.0\t300000\ntt1000004\t3.5\t300000\n',
    episode:
      'tconst\tparentTconst\tseasonNumber\tepisodeNumber\ntt1000003\ttt1000002\t2\t7\n',
  };
  for (const [kind, text] of Object.entries(files))
    await writeFile(join(dir, `title.${kind}.tsv.gz`), gzipSync(text));
}
