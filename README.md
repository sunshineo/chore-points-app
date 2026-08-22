# GemSteps Day

A singleton, offline-first daily tasks and rewards app.

## Routes

- `/` redirects to `/day`.
- `/day` is the only user interface.
- `GET /api/day` loads points, tasks, and rewards.
- `POST /api/day` applies queued task and reward events.

## Required environment

- `DATABASE_URL`

The database contains only structured day point events; there is no user or child model.

## Development

```sh
npm install
npm run dev
```

Open [http://localhost:3000/day](http://localhost:3000/day).
