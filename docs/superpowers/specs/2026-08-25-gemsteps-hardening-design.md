# GemSteps Hardening Design

**Status:** Approved for implementation planning by the 2026-08-25 project review and the user's follow-up request for a repair plan.

## Purpose

Harden the existing singleton, offline-first GemSteps PWA without replacing its product model or introducing a multi-user platform. The work must first remove known framework vulnerabilities and protect ledger/authentication invariants, then reduce avoidable database and IndexedDB work, and finally make the client code easier to test and maintain.

## Product constraints

- Keep `/` as the only user interface and preserve the current Chinese UI and task/reward behavior.
- Keep the singleton family model. Do not add users, organizations, roles, or a general permissions framework.
- Preserve offline unlock, optimistic local updates, ordered outbox delivery, idempotent event submission, and 400/409 rollback behavior.
- Keep PostgreSQL/Prisma as the server source of truth and Dexie as the client offline store.
- Keep `America/Los_Angeles` as the authoritative business time zone.
- Preserve all existing `PointEntry` rows; database changes must be additive and backfilled.
- Do not add Redux, an auth framework, a queue service, or a runtime validation package when a small typed helper is sufficient.
- Production secrets must never be logged or exposed to the browser.

## Considered approaches

### 1. Patch only

Upgrade dependencies, set Prisma transactions to `Serializable`, and delete the two lint warnings. This is the fastest option, but it leaves repeated full-ledger aggregation, weak session design, duplicate PWA update controllers, and the oversized client component.

### 2. Staged hardening — selected

Apply the framework security patch first. Then introduce shared boundary validation, a database-backed balance projection and serialized ledger writer, a high-entropy expiring session token, explicit offline-lock state, and targeted client separation. Each stage remains deployable and independently testable.

This option fixes the confirmed risks without changing the product model. It also avoids coupling all changes into one release.

### 3. Full platform redesign

Replace the singleton ledger with accounts, users, server-managed sessions, generalized event sourcing, and a background synchronization service. This would solve hypothetical future requirements but is disproportionate to the current family application.

## Target architecture

```text
Next.js page shell
  -> ProtectedApp (online session + explicit local lock)
  -> PointsPage (composition only)
       -> usePointsController (load, optimistic action, outbox drain, refresh)
       -> Dexie current snapshot + ordered outbox
       -> /api/points
            -> point-event boundary parser
            -> serialized point-ledger service
            -> PostgreSQL PointEntry + PointBalance projection
```

PWA lifecycle handling remains in `PwaUpdater`. It owns foreground, online, and 10-second service-worker update checks. `PointsPage` only owns data synchronization.

## Dependency baseline

- Node.js: `24.x`, matching the locally verified runtime and Prisma's supported range.
- Next.js and `eslint-config-next`: `16.3.3`.
- React and React DOM: `19.2.8`.
- Prisma CLI, client, and PostgreSQL adapter: `7.10.0`.
- Vitest: `4.1.11`.
- Keep `esbuild`; it satisfies the `@serwist/cli` peer dependency.

The implementation must re-run `npm audit` after regenerating `package-lock.json`. A newly reported production-reachable high/critical advisory blocks completion; a development-only or configuration-inapplicable advisory must be documented with its reachability analysis.

## Boundary validation

Create a shared `src/lib/point-event.ts` module that owns:

- event ID generation with `crypto.randomUUID()`;
- construction of client `PointEvent` objects;
- strict parsing of unknown request bodies;
- validation of known task/reward IDs and exact point magnitudes;
- validation of real calendar dates;
- verification that `dateKey` equals the Pacific date derived from `date`.

Create an `isPointsState(value: unknown): value is PointsState` boundary guard before remote JSON is written to Dexie. The helper validates numbers, selected date, and every required task/reward field; it does not silently fill missing values.

API failures return stable public messages plus a request ID. The server logs the request ID, route, and original exception without logging PINs, session tokens, or request bodies.

## Ledger consistency and projection

Add a singleton `PointBalance` table with ID `singleton`, `totalNet`, and `updatedAt`. The migration backfills `totalNet` from all existing `PointEntry` rows and installs a PostgreSQL trigger that keeps the projection synchronized for inserts, updates, and deletes. The trigger makes the migration safe even if the old application receives an event during deployment.

Move ledger writes to `src/lib/server/point-ledger.ts`. Every write transaction:

1. locks the singleton balance row with `SELECT ... FOR UPDATE`;
2. checks the event ID after acquiring the lock;
3. loads only the selected task/reward aggregate for the event date;
4. rejects a negative next total, negative task aggregate, or positive reward aggregate;
5. inserts one immutable `PointEntry`; the database trigger updates the balance projection.

This serializes the low-volume singleton ledger and makes the balance invariant independent of concurrent devices. Duplicate IDs return the existing idempotent success result.

GET reads `PointBalance.totalNet` and uses a date-filtered database `groupBy` for the selected date. It does not transfer the full ledger to Node. Add a composite index on `(dateKey, type, itemId)`.

## Authentication and lock semantics

Add required `GEMSTEPS_SESSION_SECRET` configuration with at least 32 characters of entropy. The session token contains a version and absolute expiration and is signed with HMAC-SHA-256 using that secret. The configured PIN is included in the signed message so rotating the PIN invalidates existing sessions, but the PIN is never used as the HMAC key.

The server validates token signatures and expiration. Cookie `maxAge` and token expiration use the same timestamp. The application keeps the existing 30-day device-session behavior.

Add `gemsteps-explicitly-locked` local state. Clicking lock sets it before attempting the network DELETE. Startup never accepts an online cookie while the explicit local lock is set. A successful PIN submission clears the explicit lock.

Configure a Vercel WAF fixed-window rule for `POST /api/auth`: five requests per 60 seconds keyed by IP and JA4 digest, returning 429. Document the rule and verify it in production after deployment.

## Offline storage

The current UI cannot navigate historical dates, so Dexie stores one current snapshot instead of one snapshot per day. Existing date-keyed snapshots are migrated lazily: load the latest record once, derive the requested current date, clear old snapshot records, and write key `current`.

Each optimistic event updates one snapshot and one outbox record in the same Dexie transaction. Outbox behavior and ordering remain unchanged.

Remove the unused previous/next-date handlers and constant-zero date offset. Keep the server `date` query contract because it is useful for API verification and does not add client state.

## Client boundaries

- `src/app/PointsPage.tsx`: page composition and top-level rendering only.
- `src/app/points/usePointsController.ts`: state loading, outbox drain, refresh, and point actions.
- `src/app/points/TaskSection.tsx`: task tiles and task grid.
- `src/app/points/RewardSection.tsx`: reward tiles and reward grid.
- `src/app/points/PointAdjustmentDialog.tsx`: adjustment input and validation UI.
- `src/app/points/CelebrationOverlay.tsx`: celebration rendering and animation.
- `src/app/PwaUpdater.tsx`: sole service-worker update controller.

The refactor must preserve rendered copy, button behavior, accessibility labels, and offline behavior. It follows the correctness changes so file movement does not obscure security or ledger diffs.

## Testing and delivery

- Unit tests cover token expiration/signature behavior, explicit offline locking, strict event/date validation, remote state validation, event construction, and one-snapshot migration.
- PostgreSQL integration tests cover two simultaneous redemptions, duplicate IDs, projection backfill, and GET aggregation.
- Existing 17 tests remain green.
- CI runs on Node 24 with PostgreSQL and executes install, migration, lint with zero warnings, typecheck, unit tests, integration tests, production audit, and production build.
- Deployment order: create the session secret and WAF rule; run the additive migration; deploy application code; verify auth, concurrent ledger behavior, offline lock, outbox drain, and PWA update; then monitor API errors and database totals.
- Rollback is application-safe because the old application ignores the additive table and the database trigger keeps the projection current.

## Success criteria

- No known production-reachable high or critical dependency advisory remains.
- Concurrent requests cannot make total points negative or over-undo a task/reward.
- A copied session token is rejected after its embedded expiration or after PIN/secret rotation.
- An explicit offline lock survives refresh and later reconnection.
- GET and POST no longer load every ledger row into the application process.
- Dexie contains at most one snapshot after migration.
- ESLint reports zero warnings; typecheck, all tests, integration tests, and production build pass.
- `PointsPage.tsx` is a composition file rather than the owner of synchronization, PWA lifecycle, and all child UI.
