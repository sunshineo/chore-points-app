# GemSteps Day

A singleton, offline-first daily tasks and rewards app.

## Routes

- `/` redirects to `/day`.
- `/day` is the only user interface.
- `GET /api/day` loads points, tasks, and rewards.
- `POST /api/day` applies queued task and reward events.

## Required environment

- `DATABASE_URL`
- `KIOSK_PIN` — exactly six digits; validated only on the server

The database contains only structured day point events; there is no user or child model.

## Development

```sh
npm install
npm run dev
```

Open [http://localhost:3000/day](http://localhost:3000/day).

The first visit asks for the six-digit PIN. A successful unlock is remembered for
30 days on that tablet, and the **锁定** button immediately returns to the PIN screen.
The app can continue from its local snapshot while offline after it has been unlocked
once on that device.
