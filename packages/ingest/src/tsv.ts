import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

import { z } from 'zod';

import { ImdbId } from '../../domain/src/index.js';
export const nullableInt = z.preprocess(
  (v) => (v === '\\N' ? null : v),
  z.union([z.null(), z.string().regex(/^\d+$/).transform(Number)]),
);
export const Basics = z.object({
  tconst: ImdbId,
  titleType: z.string().min(1),
  primaryTitle: z.string().min(1),
  startYear: nullableInt.pipe(z.number().int().min(1800).max(2200).nullable()),
  genres: z.string().min(1),
});
export const Rating = z.object({
  tconst: ImdbId,
  averageRating: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number)
    .pipe(z.number().min(0).max(10)),
  numVotes: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().nonnegative().safe()),
});
export const Episode = z.object({
  tconst: ImdbId,
  parentTconst: ImdbId,
  seasonNumber: nullableInt,
  episodeNumber: nullableInt,
});
export async function* lines(path: string): AsyncGenerator<string> {
  const source = createReadStream(path);
  const input = path.endsWith('.gz') ? source.pipe(createGunzip()) : source;
  // Forward source failures; readline alone does not propagate a piped source error.
  source.on('error', (e) => input.destroy(e));
  const reader = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of reader) yield line;
  } finally {
    reader.close();
    input.destroy();
    source.destroy();
  }
}
export async function validateTsv(
  path: string,
  output: string,
  kind: 'basics' | 'ratings' | 'episode',
): Promise<void> {
  const out = await open(output, 'wx');
  let headers: string[] | null = null;
  let count = 0;
  let malformed = 0;
  const samples: string[] = [];
  const schema =
    kind === 'basics' ? Basics : kind === 'ratings' ? Rating : Episode;
  try {
    for await (const line of lines(path)) {
      if (!headers) {
        headers = line.split('\t');
        const required = Object.keys(schema.shape);
        if (required.some((h) => !headers?.includes(h)))
          throw new Error(`${kind}: missing required header columns`);
        continue;
      }
      count++;
      const values = line.split('\t');
      const raw = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
      const parsed = schema.safeParse(raw);
      if (!parsed.success || values.length !== headers.length) {
        malformed++;
        if (samples.length < 5)
          samples.push(
            `row ${count + 1}: ${parsed.error?.issues[0]?.message ?? 'column count mismatch'}`,
          );
        continue;
      }
      await out.write(`${JSON.stringify(parsed.data)}\n`);
    }
  } finally {
    await out.close();
  }
  console.log(
    `${kind}: ${count.toLocaleString()} rows, ${malformed} malformed`,
    samples,
  );
  if (!count || malformed)
    throw new Error(
      `${kind}: rejected snapshot (${malformed} malformed rows; ${count} total). ${samples.join('; ')}`,
    );
}
export async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) {
    if (!Buffer.isBuffer(chunk))
      throw new TypeError('Expected a binary stream chunk');
    hash.update(chunk);
  }
  return hash.digest('hex');
}
