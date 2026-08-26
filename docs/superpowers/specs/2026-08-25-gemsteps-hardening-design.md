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

PWA lifecycle handling remains in `PwaUpdater`. It owns immediate, foreground, online, and hourly service-worker update checks. `PointsPage` only owns data synchronization. Hourly polling avoids the current 10-second update traffic while still updating a continuously visible installed app.

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

Create an `isPointsState(value: unknown): value is PointsState` boundary guard before remote JSON is written to Dexie. The helper validates nonnegative total points, selected date, and the complete configured task/reward arrays, including exact IDs, order, display fields, point values, and unique membership; it does not silently fill missing values.

API failures return stable public messages plus a request ID. The server logs the request ID, route, exception class, and safe machine-readable error code. It does not log raw exception messages, PINs, session tokens, request bodies, or connection strings.

## Ledger consistency and projection

Add a singleton `PointBalance` table with ID `singleton`, nonnegative `totalNet`, and `updatedAt`. The PostgreSQL migration runs in one explicit transaction, locks `PointEntry` against writes, creates and backfills the projection, installs the invariant trigger, and commits only after the trigger is active. The short lock removes the backfill/trigger race.

Every insert, including one made by an old application instance during a rolling deployment, is serialized through the singleton balance row. The trigger is explicitly `VOLATILE` and relies on PostgreSQL's default `READ COMMITTED` isolation so its post-lock aggregate query sees the preceding committed writer. It keeps the projection current and rejects a negative total, negative task aggregate, or positive reward aggregate. Application code uses explicit `READ COMMITTED` and still performs the same checks so normal rejected actions receive a stable 409 instead of a database exception.

Move ledger writes to `src/lib/server/point-ledger.ts`. Every write transaction:

1. locks the singleton balance row with `SELECT ... FOR UPDATE`;
2. checks the event ID after acquiring the lock;
3. loads only the selected task/reward aggregate for the event date;
4. rejects a negative next total, negative task aggregate, or positive reward aggregate;
5. inserts one immutable `PointEntry`; the database trigger updates the balance projection.

This serializes the low-volume singleton ledger and makes the balance invariant independent of concurrent devices. Duplicate IDs return the existing idempotent success result.

GET reads `PointBalance.totalNet` and uses a date-filtered database `groupBy` for the selected date. It does not transfer the full ledger to Node. Add a composite index on `(dateKey, type, itemId)`.

## Authentication and lock semantics

Add required `GEMSTEPS_SESSION_SECRET` configuration generated from at least 32 random bytes and stored in a safe textual encoding. Runtime byte length is only a minimum guard and does not claim to measure entropy. The session token contains a version and absolute expiration and is signed with HMAC-SHA-256 using that secret. The configured PIN is included in the signed message so rotating the PIN invalidates existing sessions, but the PIN is never used as the HMAC key.

The server validates token signatures and expiration. The JSON response, token, and cookie expiration are derived from one `expiresAt`; cookie `maxAge` keeps the same 30-day device-session duration.

Add `gemsteps-explicitly-locked` local state. Clicking lock sets it before attempting the network DELETE. Startup never accepts an online cookie while the explicit local lock is set. A successful PIN submission clears the explicit lock.

Configure two Vercel WAF fixed-window rules for `POST /api/auth`: five requests per 60 seconds keyed by IP in one rule and by JA4 digest in the other, both returning 429. Separate rules avoid ambiguous multi-key semantics. They are mandatory production prerequisites, must be observed in Log mode first, and require external-change authorization before publication.

The lock button is intentionally a local-device lock: it clears that browser's cookie and sets sticky local state, but it does not revoke a copied bearer token. A copied token remains valid until its absolute expiration unless the PIN or session secret is rotated. This is an accepted singleton-app tradeoff rather than a server-side session registry.

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

- Unit/component tests cover token and auth-route expiration behavior, explicit offline locking in `ProtectedApp`, strict event/date validation through the points route, exact remote state validation, event construction, cross-date one-snapshot rollback, PWA one-reload behavior, and controller effect cleanup.
- PostgreSQL integration tests run only through a localhost database whose name ends in `_test`; both the command wrapper and test client reject every other URL. They cover two simultaneous redemptions, task/reward over-undo, duplicate IDs, the actual migration backfill, projection/trigger invariants, and GET aggregation.
- Existing 17 tests remain green.
- CI runs on Node 24 with PostgreSQL and executes install, migration, lint with zero warnings, typecheck, unit tests, integration tests, production audit, and production build.
- Deployment order: create the session secret and both WAF rules; run the locked additive migration; deploy application code; verify auth, concurrent ledger behavior, offline lock, outbox drain, and PWA update; then monitor API errors and database totals.
- Rollback preserves ledger invariants because the old application ignores the additive table and the database trigger guards inserts. An old client can retain an invariant-rejected outbox event because the old route maps the trigger error to 500 rather than 409; operations must prefer roll-forward and document this limitation.

## Success criteria

- No known production-reachable high or critical dependency advisory remains.
- Concurrent requests cannot make total points negative or over-undo a task/reward.
- A copied session token is rejected after its embedded expiration or after PIN/secret rotation.
- An explicit offline lock survives refresh and later reconnection.
- GET and POST no longer load every ledger row into the application process.
- Dexie contains at most one snapshot after migration.
- ESLint reports zero warnings; typecheck, all tests, integration tests, and production build pass.
- `PointsPage.tsx` is a composition file rather than the owner of synchronization, PWA lifecycle, and all child UI.
