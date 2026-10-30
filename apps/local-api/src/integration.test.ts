import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  activeCatalog,
  backup,
  catalogInfo,
  generate,
  putList,
  putState,
  restore,
  userDb,
} from '@shukannia/db';
import { GenerateResponse, rank } from '@shukannia/domain';
import { createDemo, demoTitles } from '@shukannia/ingest/demo';
import {
  importSnapshots,
  rollback,
  updateCatalog,
  withUpdateLock,
} from '@shukannia/ingest/importer';

import { config, fixture } from '../../../tests/fixtures.js';
import { createApp } from './server.js';
const dirs: string[] = [];
async function temp() {
  const d = await mkdtemp(join(tmpdir(), 'shukannia-test-'));
  dirs.push(d);
  return d;
}
afterEach(async () => {
  vi.unstubAllGlobals();
  delete process.env['SHUKANNIA_DATA_DIR'];
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});
describe('catalog, persistence, and local API', () => {
  it('SQL ranking agrees with the domain model across policies', async () => {
    const dir = await temp();
    await createDemo(dir);
    const db = await activeCatalog(dir);
    if (!db) throw new Error('Missing demo');
    try {
      for (const mode of ['best', 'worst'] as const)
        for (const watched_policy of [
          'include',
          'hideAfter',
          'unwatchedFirst',
        ] as const)
          for (const worst_relevance of ['multiply', 'filterOnly'] as const) {
            const w = config({
              mode,
              watched_policy,
              worst_relevance,
              top_n: 5,
              tags: [
                { name: 'Action', weight: -0.7 },
                { name: 'Drama', weight: -0.3 },
                { name: 'Comedy', weight: 0 },
              ],
            });
            const states = [
              {
                imdb_id: 'tt9900000',
                watched_at: '2026-10-30T00:00:00.000Z',
                hidden: false,
                personal_rating: null,
                notes: '',
                watch_links: [],
              },
            ];
            const actual = await generate(db, w, states);
            const expected = rank(demoTitles, w, states);
            expect(
              actual.items.map((t) => [t.imdb_id, t.score, t.rank]),
            ).toEqual(expected.items.map((t) => [t.imdb_id, t.score, t.rank]));
          }
    } finally {
      await db.destroy();
    }
  });
  it('imports gzip TSV through DuckDB, inherits genres, excludes series, and rolls back without losing user data', async () => {
    const dir = await temp();
    const sources = join(dir, 'sources');
    await fixture(sources);
    const user = await userDb(dir);
    const w = config();
    await putList(user, w);
    await putState(user, {
      imdb_id: 'tt1000003',
      watched_at: '2026-10-30T00:00:00.000Z',
      hidden: false,
      personal_rating: 9,
      notes: 'Keep this',
    });
    const first = await importSnapshots(sources, dir);
    const db = await activeCatalog(dir);
    if (!db) throw new Error('No active catalog');
    try {
      const result = await generate(db, w, []);
      expect(result.items.map((t) => t.imdb_id)).toEqual([
        'tt1000003',
        'tt1000001',
        'tt1000004',
      ]);
      expect(result.items[0]?.provenance).toBe('inherited');
      expect(result.items[0]?.season).toBe(2);
      expect(result.items[2]?.score).toBeLessThan(0);
      expect(first.diagnostics.count).toBe(3);
    } finally {
      await db.destroy();
    }
    await importSnapshots(sources, dir);
    await rollback(dir);
    const current = await activeCatalog(dir);
    if (!current) throw new Error('No rollback');
    try {
      expect((await catalogInfo(current)).version).toBe(first.version);
    } finally {
      await current.destroy();
    }
    const b = await backup(user);
    expect(b.watchlists[0]?.id).toBe(w.id);
    expect(b.states[0]?.notes).toBe('Keep this');
    const other = await userDb(await temp());
    try {
      await restore(other, b);
      expect(await backup(other)).toEqual(b);
      await expect(
        restore(other, { ...b, states: [{ imdb_id: 'bad' }] }),
      ).rejects.toThrow();
      expect(await backup(other)).toEqual(b);
    } finally {
      await other.destroy();
      await user.destroy();
    }
  });
  it('failed validation, corrupt archives, missing files and concurrent updates leave the pointer unchanged', async () => {
    const dir = await temp();
    await createDemo(dir);
    const before = await readFile(join(dir, 'catalog.json'), 'utf8');
    const sources = join(dir, 'sources');
    await fixture(sources);
    await writeFile(
      join(sources, 'title.ratings.tsv.gz'),
      gzipSync('tconst\taverageRating\tnumVotes\ntt1000001\t99\t-1\n'),
    );
    await expect(importSnapshots(sources, dir)).rejects.toThrow('malformed');
    expect(await readFile(join(dir, 'catalog.json'), 'utf8')).toBe(before);
    await writeFile(join(sources, 'title.ratings.tsv.gz'), 'not gzip');
    await expect(importSnapshots(sources, dir)).rejects.toThrow();
    expect(await readFile(join(dir, 'catalog.json'), 'utf8')).toBe(before);
    await expect(importSnapshots(join(dir, 'missing'), dir)).rejects.toThrow();
    expect(await readFile(join(dir, 'catalog.json'), 'utf8')).toBe(before);
    await withUpdateLock(dir, async () => {
      await expect(importSnapshots(sources, dir)).rejects.toThrow(
        'Another update',
      );
    });
    expect(await readFile(join(dir, 'catalog.json'), 'utf8')).toBe(before);
  });
  it('validates API payloads, protects loopback writes, and persists valid actions', async () => {
    process.env['SHUKANNIA_DATA_DIR'] = await temp();
    const app = await createApp();
    const headers = { host: '127.0.0.1:4317' };
    try {
      expect(
        (await app.inject({ url: '/api/bootstrap', headers })).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/generate',
            headers,
            payload: { baseline: -1 },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/demo',
            headers: { ...headers, origin: 'https://example.com' },
            payload: { confirm: true },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            url: '/api/bootstrap',
            headers: { host: 'evil.example:4317' },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/demo',
            headers,
            payload: { confirm: true },
          })
        ).statusCode,
      ).toBe(200);
      const response = await app.inject({
        method: 'POST',
        url: '/api/generate',
        headers,
        payload: config(),
      });
      expect(response.statusCode).toBe(200);
      expect(
        GenerateResponse.parse(response.json()).items.length,
      ).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
  it('a failed download preserves the active catalog and user data', async () => {
    const dir = await temp();
    await createDemo(dir);
    const user = await userDb(dir);
    await putList(user, config());
    const before = await backup(user);
    const pointer = await readFile(join(dir, 'catalog.json'), 'utf8');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network interrupted')),
    );
    try {
      await expect(updateCatalog(dir)).rejects.toThrow('Network interrupted');
      expect(await readFile(join(dir, 'catalog.json'), 'utf8')).toBe(pointer);
      expect(await backup(user)).toEqual(before);
    } finally {
      await user.destroy();
    }
  });
  it('killing the real importer during staging cannot activate an incomplete catalog', async () => {
    const dir = await temp();
    await createDemo(dir);
    const sources = join(dir, 'sources');
    await fixture(sources);
    const pointer = await readFile(join(dir, 'catalog.json'), 'utf8');
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'packages/ingest/src/cli.ts', 'import', sources],
      {
        env: { ...process.env, SHUKANNIA_DATA_DIR: dir },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let killed = false;
    let output = '';
    const signal = await new Promise<string | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Importer did not reach staging: ${output}`));
      }, 10000);
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        if (output.includes('Staging normalized catalog with DuckDB')) {
          killed = true;
          child.kill('SIGKILL');
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on('close', (_code, termination) => {
        clearTimeout(timer);
        resolve(termination);
      });
    });
    expect(killed).toBe(true);
    expect(signal).toBe('SIGKILL');
    expect(await readFile(join(dir, 'catalog.json'), 'utf8')).toBe(pointer);
    await expect(importSnapshots(sources, dir)).rejects.toThrow(
      'Another update',
    );
    const db = await activeCatalog(dir);
    expect(db).not.toBeNull();
    await db?.destroy();
  });
});
