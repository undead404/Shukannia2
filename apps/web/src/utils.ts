import { z } from 'zod';

import { Watchlist } from '@shukannia/domain';
export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  method = 'POST',
): Promise<T> {
  const response = await fetch(
    `/api/${path}`,
    body === undefined
      ? {}
      : {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data: unknown = await response.json();
  if (!response.ok) {
    const e = z.object({ error: z.string() }).safeParse(data);
    throw new Error(
      e.success ? e.data.error : `Request failed (${response.status})`,
    );
  }
  return schema.parse(data);
}
export const Ok = z.object({ ok: z.literal(true) });
export const initial = (): Watchlist =>
  Watchlist.parse({
    id: crypto.randomUUID(),
    name: 'Beyond the ordinary',
    baseline: 6.6,
    top_n: 100,
    tags: [{ name: 'Sci-Fi', weight: 1 }],
    min_votes: 1000,
  });
export const compact = (n: number) =>
  new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
export const number = (n: number) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(n);
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
