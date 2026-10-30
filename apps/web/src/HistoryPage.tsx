import { History } from 'lucide-react';

import { HistoryRow } from './HistoryRow.js';
import type { AppModel } from './useAppModel.js';
export function HistoryPage({ model }: { model: AppModel }) {
  const { boot, result, changeState } = model;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />
            STORIES YOU’VE BEEN THROUGH
          </div>
          <h1>
            Your watch history<span>.</span>
          </h1>
          <p>A little record of where your curiosity has taken you.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Watched & hidden titles</h2>
        <p className="muted">
          History stays with you even when the catalog changes.
        </p>
        {!boot?.states.length && (
          <div className="empty">
            <History size={28} />
            <h3>Your first story is waiting.</h3>
            <p>
              Mark a title watched from your timeline to start your history.
            </p>
          </div>
        )}
        {boot?.states.map((s) => (
          <HistoryRow
            key={s.imdb_id}
            state={s}
            title={result?.items.find((t) => t.imdb_id === s.imdb_id)}
            onChange={(patch) => void changeState(s.imdb_id, patch)}
          />
        ))}
      </section>
    </>
  );
}
