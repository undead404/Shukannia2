import type { RankedTitle } from '@shukannia/domain';

import { compact, number } from './utils.js';
export function ScoreDistribution({ items }: { items: RankedTitle[] }) {
  if (!items.length) return null;
  const min = items.reduce((v, t) => Math.min(v, t.score), Infinity);
  const max = items.reduce((v, t) => Math.max(v, t.score), -Infinity);
  const bins = Array.from({ length: 6 }, (_, i) => ({
    start: min + ((max - min) * i) / 6,
    count: 0,
  }));
  for (const item of items) {
    const index =
      max === min
        ? 0
        : Math.min(5, Math.floor(((item.score - min) / (max - min)) * 6));
    const bin = bins[index];
    if (bin) bin.count++;
  }
  const peak = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div className="distribution">
      <h3>Selected score distribution</h3>
      <p>
        Current generated selection · {number(items.length)} visible stories
      </p>
      <div className="histogram" aria-label="Selected score distribution">
        {bins.map((b, i) => (
          <div key={i}>
            <span>{number(b.count)}</span>
            <div
              className="histogram-bar"
              style={{ height: `${Math.max(2, (b.count / peak) * 90)}px` }}
            />
            <small>{compact(b.start)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
