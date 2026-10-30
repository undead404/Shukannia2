import {
  ArrowRight,
  BarChart3,
  Layers3,
  LoaderCircle,
  Sparkles,
  X,
} from 'lucide-react';

import { Watchlist } from '@shukannia/domain';

import { GenreFields } from './GenreFields.js';
import { RankingFields } from './RankingFields.js';
import { ScorePreviewPanel } from './ScorePreviewPanel.js';
import type { AppModel } from './useAppModel.js';
import { WeightFields } from './WeightFields.js';
export function WatchlistBuilder({ model }: { model: AppModel }) {
  const {
    boot,
    config,
    setConfig,
    busy,
    error,
    previewBusy,
    previewScores,
    run,
    closeBuilder,
  } = model;
  return (
    <div className="modal-backdrop" onClick={closeBuilder}>
      <section
        className="builder modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="builder-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">A LITTLE CURIOSITY. YOUR RULES.</div>
            <h2 id="builder-title">Build your next journey.</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close builder"
            onClick={closeBuilder}
          >
            <X size={21} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <label>
            Watchlist name
            <input
              autoFocus
              required
              maxLength={100}
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
            />
          </label>
          <div className="form-section-heading">
            <span>Genres & relevance</span>
            <small>
              Matching relevances add; negative sums always penalize
            </small>
          </div>
          <GenreFields model={model} />
          <WeightFields model={model} />
          <RankingFields model={model} />
          {config.mode === 'worst' && (
            <label>
              Relevance in worst-ever ranking
              <select
                value={config.worst_relevance}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    worst_relevance: Watchlist.shape.worst_relevance.parse(
                      e.target.value,
                    ),
                  })
                }
              >
                <option value="multiply">Apply signed relevance</option>
                <option value="filterOnly">
                  Use relevance as a filter only
                </option>
              </select>
              <small>
                Multiplication makes negative scores less negative at lower
                weights.
              </small>
            </label>
          )}
          <label>
            Exclude genres{' '}
            <small>Comma-separated; matching any excludes a title</small>
            <input
              key={config.id}
              defaultValue={config.excluded_tags.join(', ')}
              onBlur={(e) =>
                setConfig({
                  ...config,
                  excluded_tags: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="e.g. Horror, Romance"
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={config.include_tv_movies}
              onChange={(e) =>
                setConfig({
                  ...config,
                  include_tv_movies: e.target.checked,
                })
              }
            />
            Include TV movies
          </label>
          <div className="formula-note">
            <Sparkles size={16} />
            <div>
              A = votes × (rating − baseline); score = r × (r &lt; 0 ? |A| : A)
              <small>
                Top N by score → chronological by year. No prerequisite episodes
                added.
              </small>
            </div>
          </div>
          <button
            type="button"
            className="text-button"
            disabled={previewBusy || !boot?.catalog}
            onClick={() => void previewScores()}
          >
            {previewBusy ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <BarChart3 size={14} />
            )}
            Preview score extremes
          </button>
          <ScorePreviewPanel model={model} />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={closeBuilder}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy || !boot?.catalog || config.tags.length === 0}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Layers3 size={16} />
              )}
              Save & generate
              <ArrowRight size={16} />
            </button>
          </div>
          {!boot?.catalog && (
            <p className="muted small">
              Load the demo or import a catalog before generating a timeline.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
