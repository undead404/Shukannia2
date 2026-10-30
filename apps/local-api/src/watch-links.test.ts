import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { backup, restore, userDb } from '@shukannia/db';
import { Backup, Bootstrap, WatchState } from '@shukannia/domain';

import { createApp } from './server.js';
const dirs: string[] = [];
async function temp() {
  const dir = await mkdtemp(join(tmpdir(), 'shukannia-links-'));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  delete process.env['SHUKANNIA_DATA_DIR'];
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
it('persists watch links, validates URLs, and includes them in backups', async () => {
  process.env['SHUKANNIA_DATA_DIR'] = await temp();
  const headers = { host: '127.0.0.1:4317' };
  const legacy = {
    imdb_id: 'tt1000001',
    watched_at: null,
    hidden: false,
    personal_rating: null,
    notes: 'Keep notes',
  };
  expect(WatchState.parse(legacy).watch_links).toEqual([]);
  let app = await createApp();
  try {
    const state = {
      ...legacy,
      watch_links: [
        'https://example.com/watch/movie',
        'http://example.org/episode',
      ],
    };
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: '/api/state',
          headers,
          payload: state,
        })
      ).statusCode,
    ).toBe(200);
    await app.close();
    app = await createApp();
    const boot = Bootstrap.parse(
      (await app.inject({ url: '/api/bootstrap', headers })).json(),
    );
    expect(boot.states).toEqual([state]);
    const exported = Backup.parse(
      (await app.inject({ url: '/api/backup', headers })).json(),
    );
    expect(exported.states).toEqual([state]);
    const other = await userDb(await temp());
    try {
      await restore(other, exported);
      expect(await backup(other)).toEqual(exported);
    } finally {
      await other.destroy();
    }
    for (const link of ['javascript:alert(1)', 'not a URL']) {
      expect(
        (
          await app.inject({
            method: 'PUT',
            url: '/api/state',
            headers,
            payload: { ...state, watch_links: [link] },
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(
      Bootstrap.parse(
        (await app.inject({ url: '/api/bootstrap', headers })).json(),
      ).states,
    ).toEqual([state]);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: '/api/state',
          headers,
          payload: { ...state, watch_links: [] },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      Bootstrap.parse(
        (await app.inject({ url: '/api/bootstrap', headers })).json(),
      ).states[0]?.watch_links,
    ).toEqual([]);
  } finally {
    await app.close();
  }
});
