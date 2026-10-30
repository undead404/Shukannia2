import {
  ArrowDownToLine,
  BarChart3,
  ChevronDown,
  CircleHelp,
  Database,
  History,
  Layers3,
  Plus,
  Upload,
} from 'lucide-react';

import { Backup } from '../../../packages/domain/src/index.js';
import { AppModel } from './useAppModel.js';
import { api, download, initial } from './utils.js';
export function Sidebar({ model }: { model: AppModel }) {
  const {
    boot,
    config,
    setConfig,
    result,
    page,
    setPage,
    setBuilder,
    setError,
    setHelp,
    upload,
    run,
    watched,
  } = model;
  return (
    <aside className="sidebar">
      <a
        href="#"
        className="brand"
        onClick={(e) => {
          e.preventDefault();
          setPage('timeline');
        }}
      >
        <span className="brand-icon">
          <Layers3 size={24} />
        </span>
        shukannia<span className="brand-dot">.</span>
      </a>
      <div className="workspace-label">YOUR SCREEN JOURNEY</div>
      <nav aria-label="Main navigation">
        <button
          className={page === 'timeline' ? 'nav-item active' : 'nav-item'}
          onClick={() => setPage('timeline')}
        >
          <Layers3 size={18} />
          My timeline<span className="nav-count">{result?.visible ?? 0}</span>
        </button>
        <button
          className={page === 'history' ? 'nav-item active' : 'nav-item'}
          onClick={() => setPage('history')}
        >
          <History size={18} />
          Watch history
          {watched > 0 && <span className="nav-count">{watched}</span>}
        </button>
        <button
          className={page === 'diagnostics' ? 'nav-item active' : 'nav-item'}
          onClick={() => setPage('diagnostics')}
        >
          <BarChart3 size={18} />
          Catalog insights
        </button>
      </nav>
      <div className="sidebar-section">
        <span>SAVED WATCHLISTS</span>
        <button
          className="icon-button"
          aria-label="New watchlist"
          onClick={() => {
            setConfig(initial());
            setBuilder(true);
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="saved-lists">
        {boot?.watchlists.map((w) => (
          <button
            key={w.id}
            className={`saved-list ${config.id === w.id ? 'selected' : ''}`}
            onClick={() => {
              setConfig(w);
              if (boot.catalog) void run(w);
              else setBuilder(true);
            }}
          >
            <span className="list-dot" />
            {w.name}
            <ChevronDown size={13} />
          </button>
        ))}
        {!boot?.watchlists.length && (
          <p className="muted small empty-saved">
            Your next discovery starts here.
          </p>
        )}
      </div>
      <button
        className="new-list"
        onClick={() => {
          setConfig(initial());
          setBuilder(true);
        }}
      >
        <Plus size={15} />
        Create a watchlist
      </button>
      <div className="sidebar-bottom">
        <div className="local-card">
          <div className="local-heading">
            <span className="status-dot" />
            Made for your own orbit
          </div>
          <p>
            Your catalog. Your pace.
            <br />
            Everything stays on this Mac.
          </p>
          <span>
            <Database size={12} /> LOCAL & OFFLINE
          </span>
        </div>
        <button className="nav-item" onClick={() => upload.current?.click()}>
          <Upload size={16} />
          Import watchlist or backup
        </button>
        <button
          className="nav-item"
          onClick={() => {
            void api('backup', Backup)
              .then((data) => download('shukannia-backup.json', data))
              .catch((e) => setError(String(e)));
          }}
        >
          <ArrowDownToLine size={16} />
          Export your data
        </button>
        <div className="sidebar-user">
          <span className="avatar">Y</span>
          <div>
            Your personal collection<small>Local workspace</small>
          </div>
          <button
            className="icon-button"
            aria-label="About Shukannia"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
