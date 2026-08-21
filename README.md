# GemSteps Day

A singleton, offline-first daily tasks and rewards app.

## Routes

- `/` redirects to `/day`.
- `/day` is the only user interface.
- `GET /api/day` loads points, tasks, and rewards.
- `POST /api/day/sync` applies queued task and reward events.

## Required environment

- `DATABASE_URL`
- `DAY_TOKEN`, or `DAY_SECRET`/`NEXTAUTH_SECRET` for derived tokens

The database contains only day point entries; there is no user or child model.

## Development

```sh
npm install
npm run dev
```

Open [http://localhost:3000/day](http://localhost:3000/day).
