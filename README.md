# GemSteps

A singleton, offline-first tasks, points, and rewards app.

## Routes

- `/` is the only user interface.
- Unknown browser routes redirect to `/`.
- `GET /api/points` loads points, tasks, and rewards.
- `POST /api/points` applies queued task and reward events.

## Required environment

- `DATABASE_URL`
- `GEMSTEPS_PIN` — exactly six digits; validated only on the server

The database contains only structured point events; there is no user or child model.

## Development

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The first visit asks for the six-digit PIN. A successful unlock is remembered for
30 × 24 hours on that tablet, and the **锁定** button immediately returns to the PIN
screen. The app can continue from its local snapshot while offline after it has been
unlocked once on that device.
