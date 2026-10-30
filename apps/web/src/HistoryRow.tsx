import { useState } from 'react';

import { RankedTitle, WatchState } from '../../../packages/domain/src/index.js';
export function HistoryRow({
  state,
  title,
  onChange,
}: {
  state: WatchState;
  title: RankedTitle | undefined;
  onChange: (v: Partial<WatchState>) => void;
}) {
  const [notes, setNotes] = useState(state.notes);
  return (
    <div className="history-row">
      <div>
        <strong>{title?.name ?? state.imdb_id}</strong>
        <p>
          {state.watched_at
            ? `Watched ${new Date(state.watched_at).toLocaleDateString()}`
            : 'Not watched'}
          {state.hidden ? ' · Hidden' : ''}
        </p>
      </div>
      <label>
        Personal rating
        <input
          type="number"
          aria-label={`Rating for ${state.imdb_id}`}
          min="0"
          max="10"
          step="0.5"
          value={state.personal_rating ?? ''}
          onChange={(e) => {
            if (e.target.value === '') onChange({ personal_rating: null });
            else if (e.target.validity.valid)
              onChange({ personal_rating: e.target.valueAsNumber });
          }}
        />
      </label>
      <label>
        Notes
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== state.notes) onChange({ notes });
          }}
          maxLength={10000}
        />
      </label>
      <button
        className="secondary"
        onClick={() => onChange({ hidden: !state.hidden })}
      >
        {state.hidden ? 'Unhide' : 'Hide'}
      </button>
      <button
        className="text-button"
        onClick={() =>
          onChange({
            watched_at: state.watched_at ? null : new Date().toISOString(),
          })
        }
      >
        {state.watched_at ? 'Mark unwatched' : 'Mark watched'}
      </button>
    </div>
  );
}
