import { useState } from 'react';

import { WatchState } from '@shukannia/domain';

export function WatchLinks({
  links,
  onSave,
}: {
  links: string[];
  onSave: (links: string[]) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(links.length ? links : ['']);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const normalized = draft.map((link) => link.trim()).filter(Boolean);
  const dirty = JSON.stringify(normalized) !== JSON.stringify(links);
  return (
    <form
      className="watch-links"
      onSubmit={async (event) => {
        event.preventDefault();
        const parsed = WatchState.shape.watch_links.safeParse(normalized);
        if (!parsed.success) {
          setMessage(
            'Enter valid http:// or https:// links, or remove empty fields.',
          );
          return;
        }
        setSaving(true);
        setMessage('');
        try {
          const saved = await onSave(parsed.data);
          setMessage(
            saved
              ? 'Watch links saved.'
              : 'Could not save links. Please try again.',
          );
        } catch {
          setMessage('Could not save links. Please try again.');
        } finally {
          setSaving(false);
        }
      }}
    >
      <h3>Where to watch</h3>
      <p className="muted small">
        Keep links you find for this movie or episode. Click Save links when
        finished.
      </p>
      <fieldset disabled={saving}>
        {draft.map((link, index) => (
          <div className="watch-link-row" key={index}>
            <label>
              Link {index + 1}
              <input
                type="text"
                inputMode="url"
                placeholder="https://…"
                value={link}
                maxLength={4000}
                onChange={(event) => {
                  setDraft(
                    draft.map((value, i) =>
                      i === index ? event.target.value : value,
                    ),
                  );
                  setMessage('');
                }}
              />
            </label>
            {WatchState.shape.watch_links.safeParse([link.trim()]).success && (
              <a
                className="secondary"
                href={link.trim()}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            )}
            <button
              type="button"
              className="text-button"
              aria-label={`Remove link ${index + 1}`}
              onClick={() => {
                setDraft(draft.filter((_, i) => i !== index));
                setMessage('');
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="watch-link-actions">
          <button
            type="button"
            className="secondary"
            disabled={draft.length >= 100}
            onClick={() => setDraft([...draft, ''])}
          >
            Add link
          </button>
          <button type="submit" className="primary" disabled={!dirty}>
            {saving ? 'Saving…' : 'Save links'}
          </button>
        </div>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
