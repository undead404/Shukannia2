import { Check, CircleHelp, X } from 'lucide-react';

import { Detail } from './Detail.js';
import { DiagnosticsPage } from './DiagnosticsPage.js';
import { HelpDialog } from './HelpDialog.js';
import { HistoryPage } from './HistoryPage.js';
import { Sidebar } from './Sidebar.js';
import { TimelineDebugPanel } from './TimelineDebugPanel.js';
import { TimelinePage } from './TimelinePage.js';
import { useAppModel } from './useAppModel.js';
import { WatchlistBuilder } from './WatchlistBuilder.js';
export function App() {
  const model = useAppModel();
  const {
    boot,
    config,
    page,
    builder,
    error,
    setError,
    notice,
    detail,
    setDetail,
    help,
    setHelp,
    upload,
    changeState,
    importFile,
    effective,
  } = model;
  return (
    <div className="app-shell">
      <Sidebar model={model} />
      <main>
        <header className="topbar">
          <div>
            <span className="breadcrumb">Your workspace</span>
            <span className="slash">/</span>
            {page === 'timeline'
              ? 'My timeline'
              : page === 'history'
                ? 'Watch history'
                : 'Catalog insights'}
          </div>
          <span className="local-badge">
            <span className="status-dot" />
            Local mode
          </span>
          <button
            className="icon-button"
            aria-label="How ranking works"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={18} />
          </button>
        </header>
        <div className="main-content">
          <TimelineDebugPanel />
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {page === 'timeline' && <TimelinePage model={model} />}
          {page === 'history' && <HistoryPage model={model} />}
          {page === 'diagnostics' && <DiagnosticsPage model={model} />}
        </div>
        <footer className="main-footer">
          <span>
            SHUKANNIA <span className="footer-dot">/</span> A little curiosity
            goes a long way.
          </span>
          <span>
            <span className="status-dot" />
            No accounts. No cloud. Just stories.
          </span>
        </footer>
      </main>
      <input
        ref={upload}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
          e.target.value = '';
        }}
      />
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {builder && <WatchlistBuilder model={model} />}
      {detail && (
        <Detail
          item={detail}
          state={boot?.states.find((s) => s.imdb_id === detail.imdb_id)}
          baseline={effective}
          filterOnly={
            config.mode === 'worst' && config.worst_relevance === 'filterOnly'
          }
          onClose={() => setDetail(null)}
          onChange={(patch) => {
            void changeState(detail.imdb_id, patch);
            setDetail(null);
          }}
        />
      )}
      {help && <HelpDialog model={model} />}
    </div>
  );
}
