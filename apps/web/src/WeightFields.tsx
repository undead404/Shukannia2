import type { AppModel } from './useAppModel.js';
export function WeightFields({ model }: { model: AppModel }) {
  const { config, setConfig } = model;
  return (
    <div className="weights">
      {config.tags.map((tag) => (
        <label key={tag.name}>
          <span>{tag.name}</span>
          <input
            aria-label={`${tag.name} relevance weight`}
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={tag.weight}
            onChange={(e) =>
              setConfig({
                ...config,
                tags: config.tags.map((t) =>
                  t.name === tag.name
                    ? { ...t, weight: e.target.valueAsNumber }
                    : t,
                ),
              })
            }
          />
          <span>× relevance</span>
        </label>
      ))}
    </div>
  );
}
