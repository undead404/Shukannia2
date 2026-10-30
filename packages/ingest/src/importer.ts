import { randomUUID } from 'node:crypto';
import { mkdtemp, open, readFile, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { DuckDBInstance } from '@duckdb/node-api';
import { z } from 'zod';

import {
  catalogInfo,
  connect,
  dataDir,
  insertTitles,
  migrateCatalog,
} from '../../db/src/index.js';
import { CatalogInfo, Pointer, Title } from '../../domain/src/index.js';
import {
  activate,
  finishCatalog,
  withUpdateLock,
} from './catalog-lifecycle.js';
import { hashFile, lines, validateTsv } from './tsv.js';
export {
  activate,
  finishCatalog,
  withUpdateLock,
} from './catalog-lifecycle.js';
export { hashFile, lines, validateTsv } from './tsv.js';
const Source = CatalogInfo.shape.sources.element;
type Source = z.infer<typeof Source>;
export async function importSnapshots(
  sourceDir: string,
  dir = dataDir(),
  downloadSources?: Source[],
): Promise<CatalogInfo> {
  return withUpdateLock(dir, () =>
    stageSnapshots(sourceDir, dir, downloadSources),
  );
}
async function stageSnapshots(
  sourceDir: string,
  dir: string,
  downloadSources?: Source[],
): Promise<CatalogInfo> {
  const temp = await mkdtemp(join(dir, 'staging-'));
  const version = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const catalogPath = join(dir, `catalog-${version}.sqlite`);
  let success = false;
  const sources: Source[] = [];
  try {
    for (const kind of ['basics', 'ratings', 'episode'] as const) {
      const name = `title.${kind}.tsv.gz`;
      let path = join(sourceDir, name);
      try {
        await stat(path);
      } catch {
        path = join(sourceDir, `title.${kind}.tsv`);
        await stat(path);
      }
      sources.push(
        downloadSources?.find((s) => s.name === name) ??
          Source.parse({
            name: basename(path),
            sha256: await hashFile(path),
            size: (await stat(path)).size,
            downloaded_at: new Date().toISOString(),
            etag: null,
            last_modified: null,
          }),
      );
      await validateTsv(path, join(temp, `${kind}.jsonl`), kind);
    }
    console.log('Staging normalized catalog with DuckDB');
    const instance = await DuckDBInstance.create(join(temp, 'stage.duckdb'), {
      memory_limit: '1GB',
    });
    const connection = await instance.connect();
    const output = join(temp, 'normalized.jsonl');
    try {
      for (const kind of ['basics', 'ratings', 'episode'] as const) {
        // Table identifiers are a closed internal enum. File paths are bound values.
        await connection.run(
          `CREATE TABLE ${kind} AS SELECT * FROM read_json_auto($path, format='newline_delimited')`,
          { path: join(temp, `${kind}.jsonl`) },
        );
        const dup = await connection.runAndReadAll(
          `SELECT count(*)::INTEGER AS n FROM (SELECT tconst FROM ${kind} GROUP BY tconst HAVING count(*)>1)`,
        );
        if (z.object({ n: z.number() }).parse(dup.getRowObjects()[0]).n)
          throw new Error(`${kind}: duplicate IMDb IDs`);
      }
      // COPY filenames cannot be prepared in DuckDB. Escape the internally generated local path.
      const destination = output.replaceAll("'", "''");
      await connection.run(`COPY (
        SELECT b.tconst AS imdb_id,b.titleType AS title_type,b.primaryTitle AS name,CAST(b.startYear AS INTEGER) AS original_year,
        e.parentTconst AS parent_series_imdb_id,p.primaryTitle AS series_name,
        CAST(e.seasonNumber AS INTEGER) AS season,CAST(e.episodeNumber AS INTEGER) AS episode_number,
        CAST(r.averageRating AS DOUBLE) AS average_rating,CAST(r.numVotes AS DOUBLE) AS num_votes,
        CASE WHEN b.genres='\\N' AND p.genres IS NOT NULL AND p.genres!='\\N' THEN string_split(p.genres,',') WHEN b.genres='\\N' THEN [] ELSE string_split(b.genres,',') END AS genres,
        CASE WHEN b.genres='\\N' AND p.genres IS NOT NULL AND p.genres!='\\N' THEN 'inherited' ELSE 'imdb' END AS provenance
        FROM basics b JOIN ratings r ON b.tconst=r.tconst LEFT JOIN episode e ON b.tconst=e.tconst LEFT JOIN basics p ON e.parentTconst=p.tconst
        WHERE b.titleType IN ('movie','tvMovie','tvEpisode')
      ) TO '${destination}' (FORMAT JSON, ARRAY false)`);
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
    const db = connect(catalogPath);
    try {
      await migrateCatalog(db);
      let batch: Title[] = [];
      for await (const line of lines(output)) {
        batch.push(Title.parse(JSON.parse(line)));
        if (batch.length === 1000) {
          await insertTitles(db, batch);
          batch = [];
        }
      }
      if (batch.length) await insertTitles(db, batch);
    } finally {
      await db.destroy();
    }
    const metadata = await finishCatalog(
      catalogPath,
      { version, created_at: new Date().toISOString(), demo: false, sources },
      dir,
    );
    success = true;
    return metadata;
  } finally {
    await rm(temp, { recursive: true, force: true });
    if (!success)
      for (const suffix of ['', '-wal', '-shm'])
        await rm(`${catalogPath}${suffix}`, { force: true });
  }
}
export async function updateCatalog(dir = dataDir()): Promise<CatalogInfo> {
  return withUpdateLock(dir, async () => {
    const temp = await mkdtemp(join(dir, 'downloads-'));
    const sources: Source[] = [];
    try {
      for (const kind of ['basics', 'ratings', 'episode']) {
        const name = `title.${kind}.tsv.gz`;
        const url = `https://datasets.imdbws.com/${name}`;
        console.log(`Downloading ${url}`);
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30 * 60 * 1000),
        });
        if (!response.ok || !response.body)
          throw new Error(`Download failed: ${response.status} ${name}`);
        await saveDownload(response.body, join(temp, name));
        sources.push(
          Source.parse({
            name,
            sha256: await hashFile(join(temp, name)),
            size: (await stat(join(temp, name))).size,
            downloaded_at: new Date().toISOString(),
            etag: response.headers.get('etag'),
            last_modified: response.headers.get('last-modified'),
          }),
        );
      }
      let oldSources: Source[] = [];
      try {
        const p = Pointer.parse(
          JSON.parse(await readFile(join(dir, 'catalog.json'), 'utf8')),
        );
        const old = connect(join(dir, `catalog-${p.active}.sqlite`), true);
        try {
          oldSources = (await catalogInfo(old)).sources;
        } finally {
          await old.destroy();
        }
      } catch (e) {
        if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT'))
          throw e;
      }
      if (
        sources.every((s) =>
          oldSources.some((o) => o.name === s.name && o.sha256 === s.sha256),
        )
      ) {
        console.log('All snapshot hashes unchanged; active catalog retained.');
        const p = Pointer.parse(
          JSON.parse(await readFile(join(dir, 'catalog.json'), 'utf8')),
        );
        const db = connect(join(dir, `catalog-${p.active}.sqlite`), true);
        try {
          return await catalogInfo(db);
        } finally {
          await db.destroy();
        }
      }
      return await stageSnapshots(temp, dir, sources);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
}
export async function rollback(dir = dataDir()): Promise<void> {
  await withUpdateLock(dir, async () => {
    const pointer = Pointer.parse(
      JSON.parse(await readFile(join(dir, 'catalog.json'), 'utf8')),
    );
    if (!pointer.previous) throw new Error('No previous catalog exists');
    const db = connect(join(dir, `catalog-${pointer.previous}.sqlite`), true);
    try {
      await catalogInfo(db);
    } finally {
      await db.destroy();
    }
    await activate(dir, pointer.previous);
  });
}

async function saveDownload(
  body: ReadableStream<Uint8Array>,
  path: string,
): Promise<void> {
  const file = await open(path, 'wx');
  try {
    const reader = body.getReader();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        await file.write(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    await file.close();
  }
}
