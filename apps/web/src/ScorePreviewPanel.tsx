import { GenerateResponse } from '@shukannia/domain';

import { AppModel } from './useAppModel.js';
import { compact } from './utils.js';
export function ScorePreviewPanel({ model }: { model: AppModel }) {
  const { preview } = model;
  return (
    <>
      {preview && (
        <div className="score-preview">
          {(
            [
              ['Highest scores', preview.highest],
              ['Lowest scores', preview.lowest],
            ] satisfies [string, GenerateResponse][]
          ).map(([label, data]) => (
            <div key={label}>
              <h3>{label}</h3>
              {[...data.items]
                .sort((a, b) => a.rank - b.rank)
                .map((t) => (
                  <p key={t.imdb_id}>
                    <span>{t.name}</span>
                    <strong>
                      {t.score > 0 ? '+' : ''}
                      {compact(t.score)}
                    </strong>
                  </p>
                ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
