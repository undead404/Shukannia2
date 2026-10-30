import { ArrowDown, ArrowDownToLine, ListFilter, Search } from 'lucide-react';

import { TimelineContents } from './TimelineContents.js';
import type { AppModel } from './useAppModel.js';
import { download, number } from './utils.js';
export function TimelineSection({ model }: { model: AppModel }) {
  const {
    boot,
    config,
    result,
    setBuilder,
    search,
    setSearch,
    kind,
    setKind,
    visibleLimit,
    setVisibleLimit,
    items,
  } = model;
  return (
    <section className="timeline-section">
      <div className="section-heading">
        <div>
          <h2>
            Your timeline <span>{items.length}</span>
          </h2>
          <p>
            <ArrowDown size={13} />
            Chronological by year <span className="subtle-divider">·</span>{' '}
            Selected by score first
          </p>
        </div>
        <button
          className="text-button"
          disabled={!result}
          onClick={() =>
            result &&
            download(
              `${config.name.replaceAll(/[^a-zA-Z0-9]+/g, '-')}.json`,
              result,
            )
          }
        >
          <ArrowDownToLine size={15} />
          Export list
        </button>
      </div>
      <div className="list-toolbar">
        <div className="segmented" aria-label="Title type">
          {[
            ['all', 'All stories'],
            ['movies', 'Movies'],
            ['episodes', 'Episodes'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={kind === value ? 'selected' : ''}
              onClick={() => setKind(value ?? 'all')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search timeline"
              placeholder="Find a story…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button className="filter-button" onClick={() => setBuilder(true)}>
            <ListFilter size={15} />
            <span>Filters</span>
          </button>
        </div>
      </div>
      {boot?.catalog?.demo && (
        <div className="demo-banner">
          <span className="demo-dot" />
          Demo catalog · Fictional titles and illustrative ratings. Import IMDb
          snapshots for real discoveries.
        </div>
      )}
      {<TimelineContents model={model} />}
      {items.length > visibleLimit && (
        <div className="load-more">
          <span>
            Showing {number(Math.min(visibleLimit, items.length))} of{' '}
            {number(items.length)} stories
          </span>
          <button
            className="secondary"
            onClick={() => setVisibleLimit((n) => n + 100)}
          >
            Show next 100
            <ArrowDown size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
