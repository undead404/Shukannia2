import { useState } from 'react';

import { readTimelineDebug, timelineDebugEnabled } from './timelineDebug.js';

export function TimelineDebugPanel() {
  const [report, setReport] = useState('');
  if (!timelineDebugEnabled) return null;
  return (
    <aside aria-label="Timeline debug information">
      <p>
        Timeline debug v1 is enabled. Reproduce the collapse, then collect the
        report.
      </p>
      <button
        className="secondary"
        onClick={() => setReport(readTimelineDebug())}
      >
        Collect debug report
      </button>
      {report && (
        <label>
          Copy this report into the chat
          <textarea
            aria-label="Timeline debug report"
            readOnly
            rows={12}
            style={{ width: '100%' }}
            value={report}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </aside>
  );
}
