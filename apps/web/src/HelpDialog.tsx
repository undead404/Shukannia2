import { X } from 'lucide-react';

import type { AppModel } from './useAppModel.js';
export function HelpDialog({ model }: { model: AppModel }) {
  const { setHelp } = model;
  return (
    <div className="modal-backdrop" onClick={() => setHelp(false)}>
      <section
        className="modal help-modal"
        role="dialog"
        aria-modal="true"
        aria-label="How discovery works"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Curiosity, with a clear formula.</h2>
          <button
            className="icon-button"
            aria-label="Close help"
            onClick={() => setHelp(false)}
          >
            <X />
          </button>
        </div>
        <p>
          Movies and individual TV episodes compete together. Popularity
          matters: votes multiply the distance above or below your chosen
          baseline.
        </p>
        <div className="formula-note">
          score = votes × (rating − baseline) × relevance
        </div>
        <p>
          We select the top N by score, then sort those stories by original
          year. Titles in the same year use IMDb ID as a stable tie-breaker;
          exact release order is unknown. Missing years come last.
        </p>
        <p>
          No matching genre means no match. Multiple genres use the highest
          matching weight. A zero weight excludes a record. Negative scores stay
          negative.
        </p>
        <p>
          Episodes can appear on their own, without the episodes before or after
          them. Nothing completes seasons or repairs story arcs.
        </p>
        <p className="muted">
          Local only. No telemetry, remote posters, streaming providers, or
          automatic dataset downloads.
        </p>
      </section>
    </div>
  );
}
