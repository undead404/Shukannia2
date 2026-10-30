import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import {
  Backup,
  Bootstrap,
  GenerateResponse,
  RankedTitle,
  ScorePreview,
  Watchlist,
  WatchState,
} from '../../../packages/domain/src/index.js';
import { api, initial, Ok } from './utils.js';
export type Page = 'timeline' | 'history' | 'diagnostics';
export function useAppModel() {
  const [boot, setBoot] = useState<z.infer<typeof Bootstrap> | null>(null);
  const [config, setConfig] = useState<Watchlist>(initial);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [page, setPage] = useState<Page>('timeline');
  const [builder, setBuilder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [detail, setDetail] = useState<RankedTitle | null>(null);
  const [help, setHelp] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(100);
  const upload = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<z.infer<typeof ScorePreview> | null>(
    null,
  );
  const [previewBusy, setPreviewBusy] = useState(false);
  useEffect(() => {
    setPreview(null);
  }, [config]);
  async function previewScores() {
    setPreviewBusy(true);
    setError('');
    try {
      setPreview(await api('preview', ScorePreview, Watchlist.parse(config)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewBusy(false);
    }
  }
  async function refresh() {
    const b = await api('bootstrap', Bootstrap);
    setBoot(b);
    return b;
  }
  useEffect(() => {
    let active = true;
    void api('bootstrap', Bootstrap)
      .then(async (b) => {
        if (!active) return;
        setBoot(b);
        const w = b.watchlists[0] ?? initial();
        if (!b.tags.includes(w.tags[0]?.name ?? '') && b.tags[0])
          w.tags = [{ name: b.tags[0], weight: 1 }];
        setConfig(w);
        if (b.catalog) {
          const r = await api('generate', GenerateResponse, w);
          if (active) setResult(r);
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(w = config) {
    setBusy(true);
    setError('');
    try {
      const valid = Watchlist.parse(w);
      await api('watchlist', Watchlist, valid, 'PUT');
      const r = await api('generate', GenerateResponse, valid);
      setConfig(valid);
      setResult(r);
      await refresh();
      setBuilder(false);
      setPage('timeline');
      setNotice('Watchlist saved. Your timeline is ready.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function changeState(id: string, patch: Partial<WatchState>) {
    setError('');
    try {
      const existing = boot?.states.find((s) => s.imdb_id === id);
      const state = WatchState.parse({
        imdb_id: id,
        watched_at: null,
        personal_rating: null,
        hidden: false,
        notes: '',
        ...existing,
        ...patch,
      });
      await api('state', WatchState, state, 'PUT');
      await refresh();
      if (result) setResult(await api('generate', GenerateResponse, config));
      setNotice(
        state.hidden
          ? 'Title hidden from future selections.'
          : 'Viewing history updated.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function demo() {
    setBusy(true);
    try {
      await api('demo', Ok, { confirm: true });
      await refresh();
      await run();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file: File) {
    setBusy(true);
    setError('');
    try {
      if (file.size > 32 * 1024 * 1024)
        throw new Error('Import is limited to 32 MB');
      const input: unknown = JSON.parse(await file.text());
      const backup = Backup.safeParse(input);
      if (backup.success) {
        await api('restore', Ok, backup.data);
        await refresh();
        setNotice('Watchlists and history merged from your backup.');
      } else {
        const snapshot = GenerateResponse.safeParse(input);
        const w = Watchlist.parse(
          snapshot.success ? snapshot.data.config : input,
        );
        await api('watchlist', Watchlist, w, 'PUT');
        setConfig(w);
        await refresh();
        if (boot?.catalog) await run(w);
        else
          setNotice(
            'Watchlist imported. Import a catalog to generate its timeline.',
          );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  function closeBuilder() {
    setBuilder(false);
    if (result) setConfig(result.config);
  }
  useEffect(() => {
    function close(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setBuilder(false);
        if (result) setConfig(result.config);
        setDetail(null);
        setHelp(false);
      }
    }
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [result]);
  useEffect(() => {
    setVisibleLimit(100);
  }, [result, search, kind]);
  const items =
    result?.items.filter(
      (t) =>
        (kind === 'all' ||
          (kind === 'movies'
            ? t.title_type !== 'tvEpisode'
            : t.title_type === 'tvEpisode')) &&
        `${t.name} ${t.series_name ?? ''} ${t.original_year ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) ?? [];
  const watched = boot?.states.filter((s) => s.watched_at).length ?? 0;
  const movieCount =
    result?.items.filter((t) => t.title_type !== 'tvEpisode').length ?? 0;
  const episodeCount = (result?.visible ?? 0) - movieCount;
  const knownYears =
    result?.items.flatMap((t) =>
      t.original_year === null ? [] : [t.original_year],
    ) ?? [];
  const firstYear = knownYears[0];
  const lastYear = knownYears.at(-1);
  const groups = new Map<number | null, RankedTitle[]>();
  for (const item of items.slice(0, visibleLimit)) {
    const group = groups.get(item.original_year) ?? [];
    group.push(item);
    groups.set(item.original_year, group);
  }
  const effective = result?.baseline ?? config.baseline;

  return {
    boot,
    setBoot,
    config,
    setConfig,
    result,
    setResult,
    page,
    setPage,
    builder,
    setBuilder,
    busy,
    setBusy,
    error,
    setError,
    notice,
    setNotice,
    search,
    setSearch,
    kind,
    setKind,
    detail,
    setDetail,
    help,
    setHelp,
    visibleLimit,
    setVisibleLimit,
    upload,
    preview,
    setPreview,
    previewBusy,
    setPreviewBusy,
    previewScores,
    refresh,
    run,
    changeState,
    demo,
    importFile,
    closeBuilder,
    items,
    watched,
    movieCount,
    episodeCount,
    knownYears,
    firstYear,
    lastYear,
    groups,
    effective,
  };
}
export type AppModel = ReturnType<typeof useAppModel>;
