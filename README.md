# GemSteps

A family tasks, points, and rewards project.

## Applications

| Directory | Status |
| --- | --- |
| [web](web/README.md) | Existing Next.js application with PostgreSQL and offline support |
| [ios](ios/README.md) | Placeholder for a future native iOS/iPadOS application |
| [android](android/README.md) | Placeholder for a future native Android application |

The native applications are planned to run locally without a backend. Their
initial scope is one task list repeated every day, editable manually or with
optional device AI assistance. There are no time-of-day or weekday schedules.

## Web development

Use Node.js 24 and run commands inside `web/`:

```sh
cd web
npm ci
npm run dev
```

Open http://localhost:3000. See the Web README for environment requirements.
Local environment files belong in `web/` and must remain untracked.

GitHub Actions installs, tests, and builds the Web app from `web/`. Dependabot
tracks its npm dependencies there. Husky hooks stay at the repository root;
installing Web dependencies configures them, and pre-push runs Web verification.

## Deployment

The existing Vercel project must use `web` as its Root Directory before deploying
this layout. Retain the existing project, domain, environment variables, and
database. Check any install/build/output overrides against the new directory;
the Web build command remains `npm run build` with the Next.js framework preset.
Repository directory names do not change public URL paths.

The local `.vercel/` link remains at the repository root. This directory migration
does not itself change remote settings or require a database migration. Coordinate
the Vercel setting change with the migration push; do not push this layout while
Vercel is still configured to build the old repository root.

Existing Web operational documentation is in `web/docs/`. Historical completion
records describe earlier releases, not verification of this directory migration.
