# `/day` Offline-First PWA Implementation

## Goal

After one successful online visit, `/day` must cold-start without a network,
persist task/reward/undo operations locally, and upload each operation exactly
once when connectivity returns.

## Scope decisions

- Work directly in the primary checkout on `main` by explicit user request.
- Use Serwist for the cached application shell.
- Use Dexie for both date snapshots and the durable outbox.
- Delete the existing `localStorage` queue. Do not migrate or read it.
- Keep the current UI; do not add offline/sync status UI.
- Keep the existing Prisma schema and `/api/day` endpoints unless a failing
  required test demonstrates a concrete incompatibility.
- Verify a local production build before pushing directly to production.
- Do not create a preview deployment.

## Execution

- [x] Record baseline test, lint, and production-build results.
- [x] Add Dexie schema for `daySnapshots` and `outbox`.
- [x] Replace `localStorage` queue with atomic Dexie snapshot/outbox writes.
- [x] Add one deterministic FIFO sync controller using the existing sync API.
- [x] Load a local snapshot before network refresh and support offline day rollover.
- [x] Add a `/day`-scoped Serwist service worker and precache the app shell.
- [x] Add focused database/sync tests, verify the component path in a browser,
  and retain the existing server event-ID deduplication.
- [x] Pass tests, changed-file lint, production build, and local offline browser
  verification.
- [ ] Commit `main`, push `origin main`, and verify the production deployment.
- [ ] Hand off the production build for real iPhone/iPad airplane-mode acceptance.

## Evidence

Record commands, results, changed files, commit hash, and production deployment
verification here as each step completes.

### Baseline — 2026-08-20

- `npm run test:run`: passed, 26 files / 266 tests.
- `npm run build`: passed with the existing `ENVIRONMENT_FALLBACK` messages
  during static page generation.
- `npm run lint`: existing repository baseline fails with 55 errors and 61
  warnings. The failures predate this task; final verification will require no
  new errors in changed files and will record the unchanged full-repo baseline.

### Implementation and local verification — 2026-08-21

- Implementation commit: `220eba2` (`feat: make day kiosk offline first`).
- Changed files: `/day` page and kiosk component, three offline data/sync
  modules, Serwist worker/configuration, focused tests, package manifests, and
  generated-file ignore configuration.
- Added `daySnapshots` and `outbox` to the `gemsteps-day` Dexie database.
  Snapshot updates and outbox inserts happen in the same IndexedDB transaction.
- Removed the old `day-kiosk-offline-queue:*` localStorage implementation. A
  repository search over the changed `/day` and offline modules finds no
  remaining reference; no migration or compatibility path was added.
- Added one FIFO drain controller that submits one event at a time to the
  existing `/api/day/sync/[kidId]` endpoint. Accepted events are deleted,
  network failures remain queued, and server-rejected events are rolled back.
- Kept the existing API's event marker lookup as the server-side idempotency
  boundary; no Prisma schema or API behavior change was required.
- `npm run test:run`: passed, 27 files / 273 tests, including 7 new Dexie and
  sync-controller tests. The extra test verifies strict FIFO submission order.
- Changed-file ESLint command: passed with no errors or warnings.
- `npm run lint`: the unrelated repository baseline still fails, now with 51
  errors and 58 warnings (improved from 55 errors and 61 warnings; no new
  changed-file issues). Generated `public/sw.js` is explicitly ignored.
- `npm run build`: passed. Next.js production build completed and Serwist wrote
  `public/sw.js`. The final manifest precaches 95 URLs totaling about 2.68 MB,
  including the Next font files actually needed by the offline shell. The existing
  `ENVIRONMENT_FALLBACK` build messages remain unchanged.
- Local production browser verification used `http://localhost:3100/day` with
  a fake local kid and an IndexedDB fixture because the repository's local
  database URL is an unreachable placeholder. No real points data was touched.
  Verified service-worker scope `/day`, a cached `/day` shell, offline cold
  reload, offline task completion (10 to 11 points), one durable outbox event,
  persistence across a second offline reload, and cached font availability.
