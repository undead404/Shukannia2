import { z } from 'zod';

import { userDb } from '@shukannia/db';

import { createDemo } from './demo.js';
import { importSnapshots, rollback, updateCatalog } from './importer.js';
const args = z.array(z.string()).parse(process.argv.slice(2));
try {
  const command = z
    .enum(['import', 'update', 'rollback', 'demo', 'reset-user'])
    .parse(args[0]);
  if (command === 'import') {
    const path = z.string().min(1).parse(args[1]);
    console.log(await importSnapshots(path));
  } else if (command === 'update') console.log(await updateCatalog());
  else if (command === 'rollback') await rollback();
  else if (command === 'demo') await createDemo();
  else {
    if (args[1] !== '--confirm')
      throw new Error(
        'Export a backup first. To explicitly erase watchlists, history, and generated snapshots, run pnpm user:reset --confirm. Catalogs are retained.',
      );
    const db = await userDb();
    try {
      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom('snapshot').execute();
        await trx.deleteFrom('watch_state').execute();
        await trx.deleteFrom('watchlist').execute();
      });
    } finally {
      await db.destroy();
    }
    console.log('User state reset. Catalogs retained.');
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
