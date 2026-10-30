import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { z } from 'zod';

import {
  Backup,
  CatalogInfo,
  Diagnostics,
  GenerateResponse,
  Pointer,
  RankedTitle,
  Title,
  Watchlist,
  WatchState,
} from '@shukannia/domain';

import type { Database } from './connection.js';
import { connect, dataDir } from './connection.js';
export { connect, dataDir, migrateCatalog } from './connection.js';
export async function userDb(dir = dataDir()): Promise<Kysely<Database>> {
  await mkdir(dir, { recursive: true });
  const db = connect(join(dir, 'user.sqlite'));
  await db.schema
    .createTable('watchlist')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('config', 'text', (c) => c.notNull())
    .execute();
  await db.schema
    .createTable('watch_state')
    .ifNotExists()
    .addColumn('imdb_id', 'text', (c) => c.primaryKey())
    .addColumn('data', 'text', (c) => c.notNull())
    .execute();
  await db.schema
    .createTable('snapshot')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('data', 'text', (c) => c.notNull())
    .execute();
  return db;
}
export async function activeCatalog(
  dir = dataDir(),
): Promise<Kysely<Database> | null> {
  let content: string;
  try {
    content = await readFile(join(dir, 'catalog.json'), 'utf8');
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ENOENT') return null;
    throw e;
  }
  const pointer = Pointer.parse(JSON.parse(content));
  return connect(join(dir, `catalog-${pointer.active}.sqlite`), true);
}
export async function catalogInfo(db: Kysely<Database>): Promise<CatalogInfo> {
  const row = await db
    .selectFrom('metadata')
    .select('value')
    .where('key', '=', 'info')
    .executeTakeFirstOrThrow();
  return CatalogInfo.parse(JSON.parse(row.value));
}
export async function states(db: Kysely<Database>): Promise<WatchState[]> {
  return z
    .array(WatchState)
    .parse(
      (await db.selectFrom('watch_state').selectAll().execute()).map(
        (r): unknown => JSON.parse(r.data),
      ),
    );
}
export async function lists(db: Kysely<Database>): Promise<Watchlist[]> {
  return z
    .array(Watchlist)
    .parse(
      (await db.selectFrom('watchlist').selectAll().execute()).map(
        (r): unknown => JSON.parse(r.config),
      ),
    );
}
export async function putList(
  db: Kysely<Database>,
  input: unknown,
): Promise<Watchlist> {
  const v = Watchlist.parse(input);
  await db
    .insertInto('watchlist')
    .values({ id: v.id, config: JSON.stringify(v) })
    .onConflict((c) =>
      c.column('id').doUpdateSet({ config: JSON.stringify(v) }),
    )
    .execute();
  return v;
}
export async function putState(
  db: Kysely<Database>,
  input: unknown,
): Promise<WatchState> {
  const v = WatchState.parse(input);
  await db
    .insertInto('watch_state')
    .values({ imdb_id: v.imdb_id, data: JSON.stringify(v) })
    .onConflict((c) =>
      c.column('imdb_id').doUpdateSet({ data: JSON.stringify(v) }),
    )
    .execute();
  return v;
}
export async function backup(
  db: Kysely<Database>,
): Promise<z.infer<typeof Backup>> {
  return Backup.parse({
    format: 'shukannia-v1',
    watchlists: await lists(db),
    states: await states(db),
  });
}
export async function restore(
  db: Kysely<Database>,
  input: unknown,
): Promise<void> {
  const v = Backup.parse(input);
  await db.transaction().execute(async (trx) => {
    for (const w of v.watchlists) await putList(trx, w);
    for (const s of v.states) await putState(trx, s);
  });
}
export async function insertTitles(
  db: Kysely<Database>,
  input: unknown,
): Promise<void> {
  const titles = z.array(Title).parse(input);
  await db.transaction().execute(async (trx) => {
    for (let i = 0; i < titles.length; i += 250) {
      const batch = titles.slice(i, i + 250);
      if (batch.length)
        await trx
          .insertInto('title')
          .values(
            batch.map((t) => ({ ...t, genres: JSON.stringify(t.genres) })),
          )
          .execute();
      const tags = batch.flatMap((t) =>
        [...new Set(t.genres)].map((name) => ({ imdb_id: t.imdb_id, name })),
      );
      if (tags.length) await trx.insertInto('title_tag').values(tags).execute();
    }
  });
}
export async function computeDiagnostics(
  db: Kysely<Database>,
): Promise<z.infer<typeof Diagnostics>> {
  const r =
    await sql`SELECT COUNT(*) AS count, COALESCE(AVG(average_rating),0) AS titleMean,
    COALESCE(SUM(average_rating*num_votes)/NULLIF(SUM(num_votes),0),0) AS voteMean,
    COALESCE(SUM(original_year IS NULL),0) AS unknownYears, COALESCE(SUM(title_type='tvEpisode'),0) AS episodes,
    COALESCE(SUM(title_type='tvEpisode' AND (series_name IS NULL OR season IS NULL OR episode_number IS NULL)),0) AS missingEpisodeMetadata FROM title WHERE title_type IN ('movie','tvEpisode')`.execute(
      db,
    );
  return Diagnostics.parse(r.rows[0]);
}
export async function generate(
  db: Kysely<Database>,
  config: Watchlist,
  watchStates: WatchState[],
): Promise<GenerateResponse> {
  const info = await catalogInfo(db);
  const stats = info.diagnostics;
  const baseline =
    config.baseline_strategy === 'titleMean'
      ? stats.titleMean
      : config.baseline_strategy === 'voteMean'
        ? stats.voteMean
        : config.baseline;
  const hidden = watchStates
    .filter(
      (s) =>
        s.hidden ||
        (config.watched_policy === 'unwatchedFirst' && s.watched_at),
    )
    .map((s) => s.imdb_id);
  const weights = sql.join(
    config.tags.map(
      (t) => sql`SELECT ${t.name} AS name, ${t.weight} AS weight`,
    ),
    sql` UNION ALL `,
  );
  // Inputs are always bound parameters, including JSON arrays used to avoid SQLite's variable limit.
  const relevance =
    config.mode === 'worst' && config.worst_relevance === 'filterOnly'
      ? sql`1`
      : sql`MAX(w.weight)`;
  const order = config.mode === 'worst' ? sql`ASC` : sql`DESC`;
  const result = await sql`
    WITH weights AS (${weights}), candidates AS (
      SELECT t.imdb_id, t.num_votes*(t.average_rating-${baseline})*${relevance} AS score, MAX(w.weight) AS relevance
      FROM title t JOIN title_tag tt ON tt.imdb_id=t.imdb_id JOIN weights w ON w.name=tt.name
      WHERE t.num_votes>=${config.min_votes} AND (${config.include_tv_movies ? 1 : 0}=1 OR t.title_type!='tvMovie')
      AND t.imdb_id NOT IN (SELECT value FROM json_each(${JSON.stringify([...hidden, ...config.excluded_ids])}))
      AND NOT EXISTS (SELECT 1 FROM title_tag ex WHERE ex.imdb_id=t.imdb_id AND ex.name IN (SELECT value FROM json_each(${JSON.stringify(config.excluded_tags)})))
      GROUP BY t.imdb_id HAVING MAX(w.weight)>0
    ), chosen AS (SELECT *, ROW_NUMBER() OVER (ORDER BY score ${order}, imdb_id) AS rank FROM candidates ORDER BY score ${order}, imdb_id LIMIT ${config.top_n})
    SELECT t.*, c.score, c.relevance, c.rank FROM chosen c JOIN title t ON t.imdb_id=c.imdb_id
    ORDER BY t.original_year IS NULL, t.original_year, t.imdb_id`.execute(db);
  const stateMap = new Map(watchStates.map((s) => [s.imdb_id, s]));
  const items = result.rows
    .map((row) => {
      const raw = z
        .object({ genres: z.string(), imdb_id: z.string() })
        .passthrough()
        .parse(row);
      const genres = z.array(z.string()).parse(JSON.parse(raw.genres));
      const s = stateMap.get(raw.imdb_id);
      return RankedTitle.parse({
        ...raw,
        genres,
        matched_tags: genres.filter((g) =>
          config.tags.some((t) => t.name === g),
        ),
        watched_at: s?.watched_at ?? null,
        hidden: s?.hidden ?? false,
      });
    })
    .filter((t) => config.watched_policy !== 'hideAfter' || !t.watched_at);
  return GenerateResponse.parse({
    items,
    selected: result.rows.length,
    visible: items.length,
    baseline,
    version: info.version,
    generated_at: new Date().toISOString(),
    config: { ...config, baseline },
  });
}
