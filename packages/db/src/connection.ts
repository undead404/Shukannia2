import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import Sqlite from 'better-sqlite3';
import { Kysely, sql, SqliteDialect } from 'kysely';
import { z } from 'zod';

import type { Title } from '@shukannia/domain';
export interface Database {
  title: Omit<Title, 'genres'> & { genres: string };
  title_tag: { imdb_id: string; name: string };
  metadata: { key: string; value: string };
  watchlist: { id: string; config: string };
  watch_state: { imdb_id: string; data: string };
  snapshot: { id: string; created_at: string; data: string };
}
export function dataDir(): string {
  return resolve(
    z
      .string()
      .min(1)
      .parse(
        process.env['SHUKANNIA_DATA_DIR'] ??
          join(homedir(), 'Library', 'Application Support', 'Shukannia'),
      ),
  );
}
export function connect(path: string, readonly = false): Kysely<Database> {
  const native = new Sqlite(path, { readonly });
  native.pragma('foreign_keys = ON');
  native.pragma('busy_timeout = 5000');
  if (!readonly) native.pragma('journal_mode = WAL');
  return new Kysely<Database>({
    dialect: new SqliteDialect({ database: native }),
  });
}
export async function migrateCatalog(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('title')
    .ifNotExists()
    .addColumn('imdb_id', 'text', (c) => c.primaryKey())
    .addColumn('title_type', 'text', (c) =>
      c.notNull().check(sql`title_type IN ('movie','tvMovie','tvEpisode')`),
    )
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('original_year', 'integer', (c) =>
      c.check(sql`original_year BETWEEN 1800 AND 2200`),
    )
    .addColumn('parent_series_imdb_id', 'text')
    .addColumn('series_name', 'text')
    .addColumn('season', 'integer', (c) => c.check(sql`season >= 0`))
    .addColumn('episode_number', 'integer', (c) =>
      c.check(sql`episode_number >= 0`),
    )
    .addColumn('average_rating', 'real', (c) =>
      c.notNull().check(sql`average_rating BETWEEN 0 AND 10`),
    )
    .addColumn('num_votes', 'integer', (c) =>
      c.notNull().check(sql`num_votes >= 0`),
    )
    .addColumn('genres', 'text', (c) => c.notNull())
    .addColumn('provenance', 'text', (c) => c.notNull())
    .execute();
  await db.schema
    .createTable('title_tag')
    .ifNotExists()
    .addColumn('imdb_id', 'text', (c) =>
      c.notNull().references('title.imdb_id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (c) => c.notNull())
    .addPrimaryKeyConstraint('title_tag_pk', ['imdb_id', 'name'])
    .execute();
  await db.schema
    .createIndex('tag_lookup')
    .ifNotExists()
    .on('title_tag')
    .columns(['name', 'imdb_id'])
    .execute();
  await db.schema
    .createTable('metadata')
    .ifNotExists()
    .addColumn('key', 'text', (c) => c.primaryKey())
    .addColumn('value', 'text', (c) => c.notNull())
    .execute();
}
