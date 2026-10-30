import { Check, Clock3, Layers3 } from 'lucide-react';

import { Metric } from './Metric.js';
import type { AppModel } from './useAppModel.js';
import { number } from './utils.js';
export function TimelineMetrics({ model }: { model: AppModel }) {
  const { result, movieCount, episodeCount, firstYear, lastYear } = model;
  return (
    <div className="metrics">
      <Metric
        label="IN YOUR TIMELINE"
        value={number(result?.visible ?? 0)}
        detail={`${movieCount} movies · ${episodeCount} episodes`}
        icon={<Layers3 size={18} />}
      />
      <Metric
        label="A JOURNEY ACROSS"
        value={
          firstYear !== undefined && lastYear !== undefined
            ? `${lastYear - firstYear + 1} years`
            : '—'
        }
        detail={
          firstYear !== undefined
            ? `${firstYear} — ${lastYear}`
            : 'Your story is yet to begin'
        }
        icon={<Clock3 size={18} />}
      />
      <Metric
        label="YOUR PROGRESS"
        value={`${result?.items.filter((t) => t.watched_at).length ?? 0} watched`}
        detail="One great story at a time"
        icon={<Check size={18} />}
      />
    </div>
  );
}
