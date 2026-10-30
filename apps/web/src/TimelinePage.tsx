import {
  ArrowRight,
  BookOpen,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

import { JourneySummary } from './JourneySummary.js';
import { TimelineMetrics } from './TimelineMetrics.js';
import { TimelineSection } from './TimelineSection.js';
import { AppModel } from './useAppModel.js';
export function TimelinePage({ model }: { model: AppModel }) {
  const { boot, setBuilder, busy, run } = model;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />
            THE GOOD STUFF, IN ITS OWN TIME
          </div>
          <h1>
            A different way
            <br className="mobile-break" /> through cinema<span>.</span>
          </h1>
          <p>
            Great films. Remarkable episodes. One journey through the years.
          </p>
        </div>
        <button className="primary" onClick={() => setBuilder(true)}>
          <SlidersHorizontal size={16} />
          Build a watchlist
          <ArrowRight size={16} />
        </button>
      </div>
      <JourneySummary model={model} />
      <TimelineMetrics model={model} />
      <TimelineSection model={model} />
      <div className="timeline-footer">
        <span>
          <BookOpen size={14} />
          The best stories don’t always come in order. Yours do.
        </span>
        <button
          className="text-button"
          disabled={busy || !boot?.catalog}
          onClick={() => void run()}
        >
          <RotateCcw size={13} />
          Regenerate timeline
        </button>
      </div>
    </>
  );
}
