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
- [ ] Push `main` and confirm the production deployment.

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

## Deployment prerequisite

Production must define the Sensitive variable `GEMSTEPS_PIN` before `main` is
pushed. Vercel does not allow an existing Sensitive variable to be renamed or
decrypted through the authenticated CLI/API, so this value must be added by a
person who knows the six-digit PIN. The existing production configuration has
not been removed, keeping the current deployment operational.
