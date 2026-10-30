import {
  ArrowRight,
  Database,
  LoaderCircle,
  Search,
  Sparkles,
} from 'lucide-react';

import { StoryCard } from './StoryCard.js';
import { AppModel } from './useAppModel.js';
export function TimelineContents({ model }: { model: AppModel }) {
  const { boot, setBuilder, busy, demo, items, groups } = model;
  return !boot ? (
    <div className="empty">
      <LoaderCircle className="spin" />
      <h3>Opening your local workspace</h3>
    </div>
  ) : !boot.catalog ? (
    <div className="empty">
      <div className="empty-icon">
        <Database size={28} />
      </div>
      <h3>Every great journey starts with a catalog.</h3>
      <p>
        Import your IMDb snapshots to discover films and individual episodes.
        <br />
        Or take a look around with our fictional, offline demo.
      </p>
      <button className="primary" disabled={busy} onClick={() => void demo()}>
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Sparkles size={16} />
        )}
        Explore the demo
        <ArrowRight size={15} />
      </button>
      <code>pnpm ingest /path/to/imdb-snapshots</code>
    </div>
  ) : items.length === 0 ? (
    <div className="empty">
      <Search size={28} />
      <h3>No stories in this view</h3>
      <p>
        Try a different search, lower the vote minimum, or adjust your tags.
      </p>
      <button className="secondary" onClick={() => setBuilder(true)}>
        Adjust watchlist
      </button>
    </div>
  ) : (
    <div className="timeline">
      {[...groups].map(([year, titles]) => (
        <div className="year-group" key={year ?? 'unknown'}>
          <div className="year-label">
            <span>{year ?? 'Unknown'}</span>
            <i />
          </div>
          <div className="year-stories">
            {titles.map((t) => (
              <StoryCard key={t.imdb_id} model={model} t={t} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
