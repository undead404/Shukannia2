import type { AppModel } from './useAppModel.js';
import { number } from './utils.js';
export function CatalogHealth({ model }: { model: AppModel }) {
  const { boot, config, result, effective } = model;
  return (
    <dl>
      <dt>Catalog version</dt>
      <dd>{catalogVersion(model)}</dd>
      <dt>Original years missing</dt>
      <dd>
        {number(boot?.catalog?.diagnostics.unknownYears ?? 0)} · shown last in
        the timeline
      </dd>
      <dt>Episodes missing series / season / episode metadata</dt>
      <dd>
        {number(boot?.catalog?.diagnostics.missingEpisodeMetadata ?? 0)} /{' '}
        {number(boot?.catalog?.diagnostics.episodes ?? 0)}
      </dd>
      <dt>Source</dt>
      <dd>{catalogSource(model)}</dd>
      <dt>Effective baseline</dt>
      <dd>
        {effective.toFixed(3)} · {config.baseline_strategy}
      </dd>
      <dt>Current score range</dt>
      <dd>
        {result?.items.length
          ? `${number(result.items.reduce((min, t) => Math.min(min, t.score), Infinity))} to ${number(result.items.reduce((max, t) => Math.max(max, t.score), -Infinity))}`
          : 'No selection'}
      </dd>
    </dl>
  );
}

function catalogVersion({ boot }: AppModel): string {
  return boot?.catalog?.version ?? 'Not imported';
}
function catalogSource({ boot }: AppModel): string {
  return boot?.catalog?.demo
    ? 'Fictional offline demo'
    : 'IMDb noncommercial snapshots';
}
