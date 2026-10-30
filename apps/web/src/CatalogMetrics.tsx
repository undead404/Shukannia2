import { BarChart3, Database } from 'lucide-react';

import { Metric } from './Metric.js';
import { AppModel } from './useAppModel.js';
import { number } from './utils.js';
export function CatalogMetrics({ model }: { model: AppModel }) {
  const { boot } = model;
  return (
    <div className="metrics">
      <Metric
        label="RATED MOVIES + EPISODES"
        value={number(boot?.catalog?.diagnostics.count ?? 0)}
        detail="Parent series excluded"
        icon={<Database size={18} />}
      />
      <Metric
        label="UNWEIGHTED TITLE MEAN"
        value={boot?.catalog?.diagnostics.titleMean.toFixed(3) ?? '—'}
        detail="Each title counts equally"
        icon={<BarChart3 size={18} />}
      />
      <Metric
        label="VOTE-WEIGHTED MEAN"
        value={boot?.catalog?.diagnostics.voteMean.toFixed(3) ?? '—'}
        detail="Approximation using IMDb ratings"
        icon={<BarChart3 size={18} />}
      />
    </div>
  );
}
