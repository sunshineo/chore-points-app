# Single-page refactor execution

This document tracks the implementation that makes `/` the sole user interface
and removes obsolete page-mode naming from the current source tree.

## Status

- [x] Confirm the authorized direct-to-`main` workflow and clean baseline.
- [x] Make `/` render the application and redirect unknown UI routes to `/`.
- [x] Rename the points API, application components, state model, offline storage,
      synchronization code, authentication configuration, and PWA assets.
- [x] Update tests and documentation.
- [x] Run repository-wide naming checks, lint, tests, and the production build.
- [x] Commit the verified implementation on local `main`.
- [x] Push `main` and confirm the production deployment.

## Completion evidence

- `npx next typegen`: passed; generated route types include `/`, the UI
  catch-all, `/api/auth`, and `/api/points`.
- `npx tsc --noEmit`: passed.
- `npm run test:run`: passed, 2 files and 10 tests.
- `npm run lint`: passed.
- `npm run build`: passed, including the production Next.js and service-worker
  builds.
- Local production checks: `/` returned 200; two unrelated UI paths redirected
  to `/`; both API routes remained independent.
- Source-tree naming scan: no obsolete page-mode identifiers remain; the only
  matching source token is the standard `Intl.DateTimeFormat` `weekday` option.
- Implementation commit: `670ed58`.
- Verified push commit: `e36515e`.
- Production deployment: `dpl_Et4SewyB5qciX7QUYpecNdERQ4LJ`, Ready at
  `https://chore-points-app-seven.vercel.app`.
- Production configuration now contains `GEMSTEPS_PIN` and no obsolete PIN key.

## Deployment prerequisite

Completed. Production defines the Sensitive variable `GEMSTEPS_PIN`; the
previous key was removed only after the replacement was available.
