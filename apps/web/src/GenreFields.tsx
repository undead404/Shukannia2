import { Check } from 'lucide-react';

import type { AppModel } from './useAppModel.js';
export function GenreFields({ model }: { model: AppModel }) {
  const { boot, config, setConfig } = model;
  return (
    <div className="genre-options">
      {(boot?.tags.length
        ? boot.tags
        : [
            'Sci-Fi',
            'Drama',
            'Action',
            'Adventure',
            'Mystery',
            'Comedy',
            'Thriller',
          ]
      ).map((tag) => {
        const selected = config.tags.some((t) => t.name === tag);
        return (
          <button
            type="button"
            key={tag}
            className={selected ? 'genre selected' : 'genre'}
            onClick={() =>
              setConfig({
                ...config,
                tags: selected
                  ? config.tags.filter((t) => t.name !== tag)
                  : [...config.tags, { name: tag, weight: 1 }],
              })
            }
          >
            {selected && <Check size={12} />} {tag}
          </button>
        );
      })}
    </div>
  );
}
