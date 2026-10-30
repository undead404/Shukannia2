import { CatalogHealth } from './CatalogHealth.js';
import { CatalogMetrics } from './CatalogMetrics.js';
import { ScoreDistribution } from './ScoreDistribution.js';
import type { AppModel } from './useAppModel.js';
import { number } from './utils.js';
export function DiagnosticsPage({ model }: { model: AppModel }) {
  const { boot, result } = model;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />A LOOK UNDER THE SURFACE
          </div>
          <h1>
            Know your catalog<span>.</span>
          </h1>
          <p>
            Transparent data. A baseline you choose. No mysterious algorithm.
          </p>
        </div>
      </div>
      <CatalogMetrics model={model} />
      <section className="panel diagnostics">
        <h2>Catalog health</h2>
        <CatalogHealth model={model} />
        {result && <ScoreDistribution items={result.items} />}
        <h3>Snapshot provenance</h3>
        {boot?.catalog?.sources.map((s) => (
          <div className="source" key={s.name}>
            <strong>{s.name}</strong>
            <small>
              {number(s.size)} bytes · imported{' '}
              {new Date(s.downloaded_at).toLocaleDateString()}
            </small>
            <code>SHA-256 {s.sha256}</code>
          </div>
        ))}
        <h3>Refresh on your terms</h3>
        <p>
          Updates run manually. Browsing and ranking work offline after import.
        </p>
        <code>pnpm catalog:update</code>
        <p>
          Each refresh is staged and verified before activation. Your watch
          history and watchlists are stored separately. The previous catalog
          stays available for rollback.
        </p>
        <code>pnpm catalog:rollback</code>
      </section>
    </>
  );
}
