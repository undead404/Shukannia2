import { Watchlist } from '@shukannia/domain';

import type { AppModel } from './useAppModel.js';
export function RankingFields({ model }: { model: AppModel }) {
  const { config, setConfig } = model;
  return (
    <div className="form-grid">
      <label>
        Select top N
        <input
          required
          type="number"
          min="1"
          max="100000"
          value={config.top_n}
          onChange={(e) =>
            setConfig({ ...config, top_n: e.target.valueAsNumber })
          }
        />
      </label>
      <label>
        Minimum votes
        <input
          required
          type="number"
          min="0"
          value={config.min_votes}
          onChange={(e) =>
            setConfig({
              ...config,
              min_votes: e.target.valueAsNumber,
            })
          }
        />
      </label>
      <label>
        Baseline strategy
        <select
          value={config.baseline_strategy}
          onChange={(e) =>
            setConfig({
              ...config,
              baseline_strategy: Watchlist.shape.baseline_strategy.parse(
                e.target.value,
              ),
            })
          }
        >
          <option value="manual">My threshold</option>
          <option value="titleMean">Unweighted title mean</option>
          <option value="voteMean">Vote-weighted mean</option>
        </select>
      </label>
      <label>
        Rating threshold
        <input
          required
          disabled={config.baseline_strategy !== 'manual'}
          type="number"
          min="0"
          max="10"
          step="0.01"
          value={config.baseline}
          onChange={(e) =>
            setConfig({ ...config, baseline: e.target.valueAsNumber })
          }
        />
      </label>
      <label>
        Selection mode
        <select
          value={config.mode}
          onChange={(e) =>
            setConfig({
              ...config,
              mode: Watchlist.shape.mode.parse(e.target.value),
            })
          }
        >
          <option value="best">Highest scores</option>
          <option value="worst">Worst ever · lowest scores</option>
        </select>
      </label>
      <label>
        Watched titles
        <select
          value={config.watched_policy}
          onChange={(e) =>
            setConfig({
              ...config,
              watched_policy: Watchlist.shape.watched_policy.parse(
                e.target.value,
              ),
            })
          }
        >
          <option value="include">Include in top N</option>
          <option value="hideAfter">Top N, then hide watched</option>
          <option value="unwatchedFirst">Top N unwatched</option>
        </select>
      </label>
    </div>
  );
}
