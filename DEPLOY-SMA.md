# Ackee Tester Environment

Fork-owned deployment baseline. Canonical fork:
`https://github.com/sma-rl-dev/ackee` (branch `tester-env-baseline`).
Upstream: `https://github.com/electerious/Ackee` at v3.7.1
(`700437008481bdee1cffee62bb89ec906899cff0`).
Submodule: `apps/ackee` in the training corpus.

## Quick Start

```bash
./tester-env deploy    # Build image from source, start app + mongo, wait for health, seed
./tester-env seed      # Recreate the deterministic fixtures (idempotent)
./tester-env verify    # Assert login and fixture counts over the GraphQL API
./tester-env reset     # Remove the run's containers and mongo volume
./tester-env status    # Container state, URL, credentials
./tester-env logs      # Tail container logs
```

Other commands: `stop` (preserves data), `help`.
Options: `--run-id <id>` (isolates compose project, containers and volume), `--port <port>` (default 8200).

## Deployment

- **Baseline:** v3.7.1, commit `700437008481bdee1cffee62bb89ec906899cff0`
  (latest stable non-prerelease GitHub Release, published 2026-10-23; `master` is at the same commit).
  Pinned by SHA because the tag ref is mutable.
- **Dockerfile:** `Dockerfile.tester-env` keeps devDependencies
  (`npm ci --include=dev`) and compiles the UI bundles from `src` at image build time
  (`BUILD_ENV=pre npm run build` -> `dist/index.js`, `dist/index.css`, `dist/tracker.js`).
  `npm ci` in its own layer stays cached across source-only mutations.
- **Runtime:** `npm start` (= `npm run build && npm run server`). The non-pre build only
  regenerates `dist/index.html` from container env on start; it does not clobber the
  bundles compiled in the image. Env changes need a restart, not a rebuild.
- **Image:** `${IMAGE_TAG:-tester-env-ackee:dev}` (rl-env supplies a content-addressed tag).
  `RUN_ID` scopes container/compose project/volume names only, never the image.
- **Ports:** host `${PORT:-8200}` -> container 3000.
- **Services:** two containers. `ackee` (source build) plus `mongo:7` pinned
  (Ackee 3.7.1 uses Mongoose 9, which needs MongoDB 4.4+). Mongo is not published;
  its data lives in the compose-named volume `mongo-data`, namespaced by compose
  project, so `down -v` drops exactly one run's database.
- **Credentials:** `ACKEE_USERNAME` / `ACKEE_PASSWORD` (defaults `admin` / `tester-env-admin`);
  Ackee has a single admin account.
- **Build cost (measured):** first build 46s (devDependency install dominates);
  source-only UI mutation rebuild + restart 18s (npm ci layer reused, bundle build ~10s);
  fully cached rebuild + restart 7s; settle after reset 10s.

## Frontend source-build proof

Upstream commits prebuilt `dist/` bundles, so the editable-UI path was verified explicitly:

1. Added a temporary `MUTATION-PROBE` string to
   `src/ui/scripts/components/overlays/overlay-login.js`.
2. `./tester-env deploy` rebuilt the bundles; the string appeared in the served
   `/index.js`.
3. Reverted the edit and redeployed: marker gone. The committed bundles were never
   hand-edited.

Server-side (resolver/aggregation) mutations need no frontend rebuild.

## Deterministic Setup

- Login: `admin` / `tester-env-admin` (from the fixed compose env).
- Seed: `tester-env-seed.js`, executed through the `mongo:7` service with `mongosh`.
  Direct inserts are required because Ackee's `createRecord` mutation always stamps
  `created`/`updated` with the current time (`src/models/record.js`) while every
  statistic is a relative-date aggregate.
- Verify: `tester-env-verify.py` logs in through the same authenticated GraphQL API
  the UI uses and asserts the fixture counts (`Time-Zone: UTC`, so daily buckets match).
- Seed manifest: `scenarios/ackee/seed.manifest.json` in the corpus (requirement ids
  with evidence).

### Seeded fixtures

- **Three sites:** Northstar Journal (editorial), Harbor Store (shop) and
  Northstar Docs (older history only, no traffic in the last 7 days). Fixed UUIDs.
- **137 pageviews:** 14 inside the last 24 hours across 11 page URLs, 59 in 7 days
  across 12, 104 in 30 days, 137 in 6 months across 14, plus 45/62/90/120/150-day-old
  history and a quiet day 7 days back.
- **Dimensions:** fixed visitors per site give last-24h lists of 7 systems,
  8 devices, 7 browsers, 8 browser sizes and 5 languages with stable counts.
- **Referrers:** google.com 6, newsletter 1, twitter 1, news.ycombinator.com 1 in
  24 hours (direct visits excluded by the Combined view); 7 days google 12,
  newsletter 9, Hacker News 7, Twitter 6.
- **Overview facts:** viewsToday 14, averageViews 5/day with a +50% change badge,
  averageDuration 273.1s (~4m33s); daily views chart
  `[14, 9, 7, 7, 7, 9, 6, 0, 5, 5, 5, 5, 5, 5]`. viewsMonth/viewsYear are
  calendar-derived, so verify asserts their ordering instead of fixed values.
- **4 custom events / 39 actions:** Newsletter signup (list; 24h header 3 / footer 2 /
  article 1), Checkout completed (chart; 7-day totals `[267, 59, 99, 149, 0, 89, 0]`),
  Reading time (average chart; 171.67s today) and Article rating (average list;
  field-notes 5 / tide-tables 4).
- **1 permanent token:** `Newsletter relay`.

### Idempotence and timestamps

`./tester-env seed` clears and recreates the five fixture collections, so it is
idempotent and `deploy` (which seeds) always yields the canonical state. Recent
pageviews sit inside the last 25 minutes, "yesterday" sits 25 hours back and older
pageviews sit at 14:00 UTC of a calendar day N days ago, so the 24h/7d/30d/6mo totals
are stable at any time of day.

## Browser verification targets

Use `http://host.docker.internal:8200/` from the browser container (or
`http://localhost:8200/` on the host) with `admin` / `tester-env-admin`.

1. Overview: 14 views today, 5/day average views (+50%), avg duration ~4:33,
   89 views this month, 137 this year; daily chart bars for 14 days.
2. 24 hours Pages insight: 11 URLs with a 2-view tie at the top; referrers
   google.com 6, twitter, Hacker News and newsletter 1 each.
3. 7 days Pages: 12 rows, journal home top with 8; 30 days top is `/pricing` with 14.
4. Systems/devices/browsers/sizes/languages each show multiple entries; Windows 11 x6
   in the 24h systems list.
5. Events: Newsletter signup 24h list header 3 / footer 2 / article 1; Checkout
   completed chart; Reading time and Article rating averages.
6. Settings lists 3 domains, 4 events and the `Newsletter relay` permanent token;
   domain add/rename/delete is visible in the Domains menu.

## Reset Path

`./tester-env reset` runs `docker compose ... down -v --remove-orphans`, removing the
app container, the mongo container, the compose network and the run-scoped mongo
volume. It never removes the image (content-addressed tags are shared across runs;
use `scripts/rl-env gc --prune-images`). Verified: reset -> deploy -> verify passes
from a fresh volume, twice, with the same deterministic login.

## Submodule deployment proof (2026-11-14)

Verified from the fork-backed submodule at `apps/ackee`, not from the prospect
checkout:

```bash
cd apps/ackee
IMAGE_TAG=tester-env-ackee:fork-integrate ./tester-env deploy --run-id fork-integrate --port 8097
./tester-env verify --run-id fork-integrate --port 8097   # exit 0
./tester-env reset  --run-id fork-integrate
IMAGE_TAG=tester-env-ackee:fork-integrate ./tester-env deploy --run-id fork-integrate --port 8097
./tester-env verify --run-id fork-integrate --port 8097   # exit 0
./tester-env reset  --run-id fork-integrate
```

- Build was fully cached (`npm ci` and `BUILD_ENV=pre` bundle layers) and named the
  image `tester-env-ackee:fork-integrate`; the default instance's `:dev` tag was
  not touched.
- Each `deploy` started `tester-env-ackee-fork-integrate` plus
  `tester-env-ackee-fork-integrate-mongo-1`, was healthy after 4s and seeded
  `3 domains, 137 pageviews, 4 custom events, 39 actions, 1 permanent token`.
- `verify` reported: 3 domains (Harbor Store, Northstar Docs, Northstar Journal);
  viewsToday 14, averageViews 5/day (+50%), averageDuration 273.1s, viewsMonth 89,
  viewsYear 137; 24h pages 14 across 11 URLs, 4 referrers, 7 systems, 8 devices,
  7 browsers, 8 sizes, 5 languages; 7d 59 / 30d 104 / 6mo 137 pageviews; docs 7d
  empty and 6mo 10; 14-day chart
  `[14, 9, 7, 7, 7, 9, 6, 0, 5, 5, 5, 5, 5, 5, 0]`; checkout 7d
  `[267, 59, 99, 149, 0, 89, 0]`; `Newsletter relay` permanent token.
- Both reset cycles removed only `tester-env-ackee-fork-integrate`,
  `tester-env-ackee-fork-integrate-mongo-1`, the run's mongo volume and compose
  network. The default instance on port 8200 stayed at HTTP 200 throughout, and
  shared browser infrastructure was untouched.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `IMAGE_TAG` | `tester-env-ackee:dev` | Image tag; set by `scripts/rl-env` |
| `RUN_ID` | `default` | Suffixes container/compose project/volume names |
| `PORT` | `8200` | Host port |
| `ACKEE_USERNAME` | `admin` | Deterministic admin username |
| `ACKEE_PASSWORD` | `tester-env-admin` | Deterministic admin password |
| `ACKEE_TTL` | `86400000` | Session lifetime (compose) |

## Caveats

- One admin credential only; there is no multi-user permission surface.
- All statistics are relative-date aggregates (24h/7d/30d/6mo), so fixtures must use
  offsets from seed time.
- Requests carrying the `ackee_ignore=1` cookie are silently dropped
  (`createRecord` returns sentinel `88888888-8888-8888-8888-888888888888`), so seeds
  must not reuse a logged-in browser cookie.
- Active visitors (the Live badge) only counts pageviews updated within the last
  30 seconds, so it reads 0 unless the browser opens right after seeding.
- `verify` queries with `Time-Zone: UTC`; seeded times sit between 09:00 and 15:00 UTC,
  so daily buckets match for any client timezone from UTC-8 to UTC+7.
- Base images are pinned by tag (`node:24-alpine`, `mongo:7`), not by digest, so the
  build is not bit-reproducible.

## Scenario Integration

`scenario.meta.json` `deploy.copy_paths` must include `Dockerfile.tester-env`,
`docker-compose.tester-env.yml`, `tester-env-seed.js` and `tester-env-verify.py`
(the CLI is `app_cli = "tester-env"`). `url_template`: `http://localhost:{port}/`.
Reset/deploy/seed are all CLI-driven: `./tester-env reset && ./tester-env deploy`
for a clean slate, or `./tester-env seed` to repair drift on a running instance.
