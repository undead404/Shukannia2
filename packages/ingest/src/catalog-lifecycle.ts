import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { sql } from 'kysely';

import {
  catalogInfo,
  computeDiagnostics,
  connect,
  generate,
} from '../../db/src/index.js';
import { CatalogInfo, Pointer, Watchlist } from '../../domain/src/index.js';
export async function withUpdateLock<T>(
  dir: string,
  task: () => Promise<T>,
): Promise<T> {
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'update.lock');
  let lock;
  try {
    lock = await open(path, 'wx');
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'EEXIST')
      throw new Error(
        'Another update is running, or an interrupted update left update.lock. Verify no importer is running before removing this lock.',
        { cause: e },
      );
    throw e;
  }
  try {
    await lock.writeFile(
      JSON.stringify({
        pid: process.pid,
        started_at: new Date().toISOString(),
      }),
    );
    return await task();
  } finally {
    await lock.close();
    await rm(path, { force: true });
  }
}
export async function activate(dir: string, version: string): Promise<void> {
  let previous: string | null = null;
  try {
    previous = Pointer.parse(
      JSON.parse(await readFile(join(dir, 'catalog.json'), 'utf8')),
    ).active;
  } catch (e) {
    if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) throw e;
  }
  const pointer = Pointer.parse({ active: version, previous });
  const tmp = join(dir, `pointer-${randomUUID()}.tmp`);
  const f = await open(tmp, 'wx');
  try {
    await f.writeFile(JSON.stringify(pointer));
    await f.sync();
  } finally {
    await f.close();
  }
  await rename(tmp, join(dir, 'catalog.json'));
}
export async function finishCatalog(
  path: string,
  info: Omit<CatalogInfo, 'diagnostics'>,
  dir: string,
): Promise<CatalogInfo> {
  const db = connect(path);
  let metadata: CatalogInfo;
  try {
    const diagnostics = await computeDiagnostics(db);
    if (!diagnostics.count)
      throw new Error('Empty normalized catalog; activation refused');
    metadata = CatalogInfo.parse({ ...info, diagnostics });
    await db
      .insertInto('metadata')
      .values({ key: 'info', value: JSON.stringify(metadata) })
      .execute();
    const check = await sql`PRAGMA integrity_check`.execute(db);
    if (JSON.stringify(check.rows) !== '[{"integrity_check":"ok"}]')
      throw new Error('SQLite integrity check failed');
    const fk = await sql`PRAGMA foreign_key_check`.execute(db);
    if (fk.rows.length) throw new Error('SQLite foreign key check failed');
    const tag = await db
      .selectFrom('title_tag')
      .select('name')
      .executeTakeFirst();
    if (tag)
      await generate(
        db,
        Watchlist.parse({
          id: randomUUID(),
          name: 'Validation',
          baseline: 6.6,
          top_n: 10,
          tags: [{ name: tag.name, weight: 1 }],
        }),
        [],
      );
    // Large drops require an explicit operator override; normal growth remains allowed.
    try {
      const pointer = Pointer.parse(
        JSON.parse(await readFile(join(dir, 'catalog.json'), 'utf8')),
      );
      const old = connect(join(dir, `catalog-${pointer.active}.sqlite`), true);
      let prior;
      try {
        prior = await catalogInfo(old);
      } finally {
        await old.destroy();
      }
      if (
        !prior.demo &&
        !info.demo &&
        diagnostics.count < prior.diagnostics.count * 0.8 &&
        process.env['SHUKANNIA_ALLOW_LARGE_DROP'] !== '1'
      )
        throw new Error(
          'Catalog shrank more than 20%; review snapshots, then explicitly set SHUKANNIA_ALLOW_LARGE_DROP=1 if intended',
        );
    } catch (e) {
      if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) throw e;
    }
    await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(db);
  } finally {
    await db.destroy();
  }
  await activate(dir, info.version);
  return metadata;
}
