import { Film, Settings2, Sparkles } from 'lucide-react';

import { AppModel } from './useAppModel.js';
import { number } from './utils.js';
export function JourneySummary({ model }: { model: AppModel }) {
  const { config, setBuilder, effective } = model;
  return (
    <section className="journey-card">
      <div className="journey-copy">
        <div className="journey-kicker">
          <Sparkles size={14} />
          YOUR CURRENT WATCHLIST
        </div>
        <h2>{config.name}</h2>
        <p>
          Follow the stories that stand out.
          <br />
          Let the years take care of the order.
        </p>
        <div className="journey-tags">
          {config.tags.map((t) => (
            <span key={t.name}>
              {t.name}
              {t.weight !== 1 ? ` · ${t.weight}×` : ''}
            </span>
          ))}
          <span className="outline-tag">Movies + individual episodes</span>
        </div>
      </div>
      <div className="orbit-art" aria-hidden="true">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="orbit orbit-three" />
        <div className="orbit-core">
          <Film size={30} strokeWidth={1} />
        </div>
        <span className="orbit-point p1" />
        <span className="orbit-point p2" />
        <span className="orbit-point p3" />
        <span className="orbit-year y1">1968</span>
        <span className="orbit-year y2">1999</span>
        <span className="orbit-year y3">2024</span>
      </div>
      <div className="journey-settings">
        <div>
          <span>SELECTION</span>
          <strong>Top {number(config.top_n)}</strong>
        </div>
        <div>
          <span>RATING BASELINE</span>
          <strong>
            {effective.toFixed(2)}
            <small> / 10</small>
          </strong>
        </div>
        <button onClick={() => setBuilder(true)}>
          Fine-tune watchlist
          <Settings2 size={14} />
        </button>
      </div>
    </section>
  );
}
