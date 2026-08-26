# GemSteps

A singleton, offline-first tasks, points, and rewards app.

## Routes

- `/` is the only user interface.
- Unknown browser routes redirect to `/`.
- `GET /api/points` loads points, tasks, and rewards.
- `POST /api/points` applies queued task and reward events.

## Required environment

- Node.js 24
- `DATABASE_URL` — the application database connection URL
- `GEMSTEPS_PIN` — exactly six digits; validated only on the server
- `GEMSTEPS_SESSION_SECRET` — at least 32 random bytes, stored in a safe textual encoding

`openssl rand -base64 32` prints a generated session secret to standard output:

```sh
openssl rand -base64 32
```

Do not commit, record, or share that output. Store it directly as a sensitive
environment value using an approved secret-management workflow.

The runtime length check is only a minimum guard and cannot measure entropy.
Operators must generate the value from at least 32 random bytes and store it as a
sensitive environment variable.

`GEMSTEPS_TEST_DATABASE_URL` is separate and test-only. It must use a loopback
host, must end in `_test`, and must never contain copied Production credentials.

The database contains only structured point events; there is no user or child model.

## Development

Install Node.js 24, then run:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The first visit asks for the six-digit PIN. A successful unlock is remembered for
30 × 24 hours on that tablet, and the **锁定** button immediately returns to the PIN
screen. The app can continue from its local snapshot while offline after it has been
unlocked once on that device.
