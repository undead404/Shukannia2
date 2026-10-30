# Shukannia

A personal, local-only movie and individual TV episode discovery app. Select the top N by `votes × (rating − baseline) × relevance`, then browse the selection **chronologically by year**. Popularity is deliberately linear; negative scores are preserved. Series never enter the feed as viewing records, and no prerequisite episodes are added.

## Requirements & run

Node.js 24 LTS and pnpm 10.20.0. Versions are pinned in `.node-version` and `package.json`; dependencies are locked in `pnpm-lock.yaml`.

```sh
pnpm install
pnpm dev
# Open http://127.0.0.1:5173
```

For a production-like local run:

```sh
pnpm build
pnpm start
# Open http://127.0.0.1:4317
```

The API binds only to `127.0.0.1:4317`; Vite binds to `127.0.0.1:5173`. Use those addresses instead of `localhost`; the API checks Host and Origin. No accounts, telemetry, hosted services, or remote assets. IMDb detail links navigate externally only when clicked.

The first launch has no catalog. **Explore the demo** creates a clearly labeled fictional catalog without network access. It is not IMDb data. Alternatively, `pnpm demo` creates it explicitly. Importing a real catalog replaces the demo while retaining user history and watchlists.

## Import real data

Download these files from the [official IMDb noncommercial dataset index](https://datasets.imdbws.com/):

- `title.basics.tsv.gz`
- `title.ratings.tsv.gz`
- `title.episode.tsv.gz`

Keep them together in one directory, then run:

```sh
pnpm ingest /absolute/path/to/imdb-snapshots
```

Uncompressed `.tsv` files are also supported. Each TSV row crosses Zod validation; malformed rows fail the import with counts and sample errors. Unknown years, seasons, and episode numbers remain `null`. Only rated movies, TV movies, and episodes are retained. TV movies are excluded from watchlists by default. Missing episode genres inherit parent-series genres with explicit provenance. Parent series are staging metadata, not viewing records.

For an explicit download and refresh of all three current snapshots:

```sh
pnpm catalog:update
pnpm catalog:rollback
```

These are large full snapshots. Allow sufficient network bandwidth, time, and disk space (raw compressed files, validated JSONL, a DuckDB staging database, a new SQLite catalog, and prior catalogs coexist during staging). No full IMDb download has been performed as part of development. Check IMDb's current applicable noncommercial terms before using or distributing its data. The app does not redistribute a catalog.

The downloader records response metadata and hashes complete archives rather than trusting HTTP cache headers. Identical hashes skip activation. There is no scheduled update service.

## Storage & refresh safety

Default data directory on macOS:

```text
~/Library/Application Support/Shukannia/
  user.sqlite               # watchlists, history, latest 20 generated snapshots
  catalog.json              # atomic active/previous version pointer
  catalog-<version>.sqlite  # immutable, versioned IMDb catalogs
```

Override with `SHUKANNIA_DATA_DIR=/absolute/path`. Use the **same directory for the server and import CLI**. For an entirely project-local setup:

```sh
export SHUKANNIA_DATA_DIR="$PWD/.data"
pnpm dev
# In another terminal, export the same variable before invoking ingest/update.
```

Refreshes acquire an exclusive lock, validate and join snapshots in DuckDB, insert validated titles through Kysely into a new SQLite database, run integrity/foreign-key and ranking checks, close connections, then atomically switch the pointer. The API opens the active catalog per request, so a refresh never replaces an open database. User state is separate and references IMDb IDs.

Failures leave the active pointer and user data unchanged. A real process interruption can leave `update.lock`, staging folders, and an inactive catalog. The next update refuses to run. Check the PID in the lock and verify no importer is running before manually removing that lock; only then remove orphan staging files if needed. Do not delete files referenced by `catalog.json`. Previous catalogs are deliberately retained for rollback; automatic pruning is not implemented.

An actual catalog shrinking by more than 20% fails activation. After reviewing source files, an operator can explicitly allow the drop with `SHUKANNIA_ALLOW_LARGE_DROP=1`. Demo-to-real imports bypass that count comparison.

## Watchlists & history

- Select genres and nonnegative per-watchlist relevance weights. Use the maximum matching weight; unmatched records and zero relevance are excluded.
- Set top N (up to 100,000), minimum votes, exclusions, movie policy, and manual/unweighted/vote-weighted baseline. Baseline diagnostics use rated movies and episodes, excluding TV movies and parent series.
- Best mode selects descending scores. Worst mode selects ascending scores and explicitly lets you choose multiplying relevance or filtering only.
- Watched policies are distinct: include; select top N then hide watched; or select top N from unwatched records. Hidden records and explicit exclusions are removed before selection.
- Within a year, IMDb ID is the deterministic tie-breaker. Unknown years sort last. No exact release dates are invented.
- Timeline search/type filters affect presentation only. Long selections render in batches of 100 without changing selection or export.
- Mark watched, hide/unhide, and edit personal ratings/notes in history. Data survives catalog replacement.
- Export/import backups of saved watchlists and watch history from the sidebar. Restore validates the entire file before a transaction and **merges by ID**, rather than deleting existing data. Standalone watchlists and exported generated lists can also be imported as watchlist configurations and regenerated on the current catalog.
- Export a generated list to preserve visible IDs, scores, selection configuration, resolved baseline, dataset version, and generation time. The server also retains the most recent 20 results; `/api/snapshots` lists them, and `/api/snapshots/:id` retrieves one.

To explicitly erase all user-owned watchlists, history, and generated snapshots, export a backup first, stop the app, then run `pnpm user:reset --confirm`. The confirmation flag is required. Imported catalogs are retained. This action cannot be undone without a backup.

## Code quality

```sh
pnpm check         # ESLint, Stylelint, Prettier, and TypeScript
pnpm lint:fix      # Fix lint issues where possible
pnpm format        # Format source, styles, configuration, and docs
pnpm test          # Run the test suite
```

ESLint uses type-aware TypeScript analysis with the project service, React Hooks
checks, and sorted imports. ESLint enforces a maximum of 300 nonblank,
noncomment lines per JavaScript/TypeScript file, cyclomatic complexity of 15 per
function, and control-flow nesting depth of 4, including tests and configuration.
Prettier owns formatting (80 columns, single quotes,
trailing commas), and Stylelint checks CSS. Specificity ordering is left to the
stylesheet's component and responsive sections because those selectors often
target separate elements. Generated builds, local data, dependencies, and coverage
are excluded from these checks.

`pnpm install` installs the Husky pre-commit hook. It runs lint-staged to lint and
format staged files; `pnpm check` checks the whole workspace. GitHub Actions runs
the full checks, tests, and production build on pushes and pull requests.

The setup takes inspiration from [ymh8](https://github.com/undead404/ymh8) and
[Koreni](https://github.com/undead404/koreni), adapted for this pnpm/Vite workspace.

## Workspace layout

```text
apps/web          React + Vite interface
apps/local-api    loopback Fastify API and static serving
packages/domain   shared Zod contracts and reference ranking model
packages/db       typed Kysely schema, migrations, persistence, SQL ranking
packages/ingest   TypeScript TSV validation, DuckDB staging, refresh CLI
tests             domain and temporary-SQLite/import/API tests
```

```sh
pnpm typecheck
pnpm test
pnpm build
```

Tests cover the document's score examples; score-before-year selection; matching, weighting, unknown years and stable ties; watched policies; SQL/domain agreement; real gzip/DuckDB/SQLite imports; genre inheritance; parent exclusion; validation rejection; backup round trips; failed downloads; corrupt archives; concurrent updates; a real importer killed during staging; successful activation/rollback; and local API validation.

Optional exact-date/TMDB enrichment, Trakt sync, scheduling, title-specific weights, and keyword overrides remain outside the MVP. Full IMDb-scale performance has not yet been benchmarked.
