# GemSteps Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove known framework vulnerabilities, make the singleton point ledger and PIN session correct under hostile/concurrent conditions, and reduce the client/server maintenance hotspots without changing GemSteps product behavior.

**Architecture:** Preserve the existing Next.js + Prisma + Dexie event flow. Add strict shared boundary helpers, serialize ledger writes through a locked singleton balance projection, sign expiring sessions with a high-entropy secret, store only one offline snapshot, and separate PWA/data/UI responsibilities after correctness fixes land.

**Tech Stack:** Node.js 24, Next.js 16.3.3, React 19.2.8, TypeScript, Prisma 7.10/PostgreSQL, Dexie, Serwist, Tailwind CSS, Vitest 4.1.11, GitHub Actions, Vercel WAF.

**Spec:** `docs/superpowers/specs/2026-08-25-gemsteps-hardening-design.md`

## Global Constraints

- Work directly on the repository's existing `main` checkout; do not create a branch or worktree.
- Preserve unrelated user changes and inspect `git status --short --branch` before every commit.
- Keep `/` as the only UI and preserve current Chinese copy, task/reward configuration, Pacific time behavior, offline outbox order, and 400/409 rollback semantics.
- Keep the singleton family model; do not add users, roles, Redux, an auth framework, a queue service, or a runtime schema dependency.
- Never read, print, commit, or log `.env` values, PINs, session tokens, or database credentials.
- Never run an integration test, migration reset, seed, or smoke test against `DATABASE_URL` directly. Use explicit `GEMSTEPS_TEST_DATABASE_URL`; both the command wrapper and test client must reject non-local hosts and database names that do not end in `_test`.
- Use `GEMSTEPS_SESSION_SECRET` for the new high-entropy session key; require at least 32 random bytes (stored in a safe textual encoding).
- Existing `PointEntry` rows are immutable production data. Database migration must be additive, backfilled, and safe while old application code is still serving traffic.
- Each task follows red-green-refactor where behavior changes, ends with focused verification, and creates one reviewable commit.
- Do not deploy or change Vercel production settings until the user separately authorizes external state changes during execution.

---

### Task 1: Patch the framework and align the supported runtime

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: the current npm project and Node 24 runtime.
- Produces: reproducible dependency versions, `npm run typecheck`, and `npm run verify` for every later task.

- [x] **Step 1: Record the pre-upgrade baseline**

Run:

```bash
git status --short --branch
node --version
npm run test:run
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Expected: clean tracked worktree apart from this plan/spec work; 17 tests pass; typecheck and build exit 0; lint reports exactly the two known unused date-handler warnings. The build refreshes ignored `.next/` and `public/sw.js` artifacts but no tracked source.

- [x] **Step 2: Install the exact security baseline**

Run:

```bash
npm install --save-exact next@16.3.3 react@19.2.8 react-dom@19.2.8 @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0
npm install --save-dev --save-exact eslint-config-next@16.3.3 prisma@7.10.0 vitest@4.1.11 @types/node@24.13.3 @testing-library/react@16.3.2 jsdom@30.0.1
```

Expected: `package.json` and `package-lock.json` change; Prisma client generation completes; npm reports no invalid peer dependency. Keep the existing top-level `esbuild` entry because `@serwist/cli` declares it as a peer.

- [x] **Step 3: Pin Node and add reusable verification scripts**

Add these keys to `package.json` while leaving the existing scripts intact:

```json
{
  "engines": {
    "node": "24.x"
  },
  "scripts": {
    "typecheck": "tsc --noEmit --incremental false",
    "verify": "npm run lint && npm run typecheck && npm run test:run && npm run build"
  }
}
```

Expected: `npm pkg get engines scripts.typecheck scripts.verify` prints `24.x` and both exact commands.

- [x] **Step 4: Verify the upgraded dependency graph**

Run:

```bash
npm ls --depth=0
npm run verify
npm audit --omit=dev --audit-level=high
```

Expected: dependency tree is valid; tests/typecheck/build pass; lint still has only the two pre-existing warnings. The production audit exits 0. If npm reports a high/critical advisory, open its primary advisory, determine whether it is reachable in this application, and do not proceed until a patched version is installed or the non-reachability evidence is added to the design document.

- [x] **Step 5: Commit the dependency patch**

Run:

```bash
git add package.json package-lock.json
git commit -m "chore: patch framework dependencies"
```

Expected: one commit containing only dependency/runtime metadata.

---

### Task 2: Centralize point-event and API response validation

**Files:**
- Create: `src/lib/point-event.ts`
- Create: `src/lib/points-state.ts`
- Create: `src/__tests__/lib/point-event.test.ts`
- Create: `src/__tests__/lib/points-state.test.ts`
- Create: `src/__tests__/api/points-route.test.ts`
- Modify: `src/app/api/points/route.ts`
- Modify: `src/app/PointsPage.tsx`

**Interfaces:**
- Consumes: `PointEvent`, `PointsState`, configured tasks/rewards, `getDateKeyPT`, and manual-adjustment limits from `src/lib/points.ts`.
- Produces: `createPointEvent(draft, options): PointEvent`, `parsePointEvent(value): PointEvent | null`, `isValidDateKey(value): value is string`, and `isPointsState(value): value is PointsState`.

- [x] **Step 1: Write failing point-event boundary tests**

Create the new test directory once:

```bash
mkdir -p src/__tests__/api
```

Create `src/__tests__/lib/point-event.test.ts` with these cases:

```ts
import { describe, expect, it } from "vitest";
import { createPointEvent, isValidDateKey, parsePointEvent } from "@/lib/point-event";

describe("point event boundary", () => {
  it("constructs an event with a supplied ID and Pacific date", () => {
    const event = createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { id: "event-1", now: new Date("2026-08-25T16:00:00.000Z") },
    );

    expect(event).toEqual({
      id: "event-1",
      type: "task",
      itemId: "seed-task-face",
      points: 1,
      dateKey: "2026-08-25",
      date: "2026-08-25T16:00:00.000Z",
    });
  });

  it("generates a UUID when no ID is supplied", () => {
    const event = createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { now: new Date("2026-08-25T16:00:00.000Z") },
    );

    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("accepts a configured event and rejects forged points", () => {
    const event = createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { id: "event-1", now: new Date("2026-08-25T16:00:00.000Z") },
    );

    expect(parsePointEvent(event)).toEqual(event);
    expect(parsePointEvent({ ...event, points: 99 })).toBeNull();
  });

  it("rejects impossible or mismatched Pacific dates", () => {
    const event = createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { id: "event-1", now: new Date("2026-08-25T16:00:00.000Z") },
    );

    expect(parsePointEvent({ ...event, dateKey: "2026-02-31" })).toBeNull();
    expect(parsePointEvent({ ...event, dateKey: "2026-08-24" })).toBeNull();
  });

  it("validates real calendar date keys", () => {
    expect(isValidDateKey("2026-08-25")).toBe(true);
    expect(isValidDateKey("2026-02-31")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
  });
});
```

- [x] **Step 2: Write failing remote-state and route-adapter tests**

Create `src/__tests__/lib/points-state.test.ts` with the complete configured state and corrupt variants:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_REWARDS, DEFAULT_TASKS } from "@/lib/points";
import { isPointsState } from "@/lib/points-state";

const validState = {
  totalNet: 10,
  selectedDate: "2026-08-25",
  selectedDateNet: 1,
  tasks: DEFAULT_TASKS.map((task) => ({ ...task, completedCount: 0 })),
  rewards: DEFAULT_REWARDS.map((reward) => ({ ...reward, redeemedCount: 0 })),
};

describe("points state boundary", () => {
  it("accepts a complete finite state", () => {
    expect(isPointsState(validState)).toBe(true);
  });

  it("rejects missing arrays and non-finite numbers", () => {
    expect(isPointsState({ ...validState, tasks: undefined })).toBe(false);
    expect(isPointsState({ ...validState, totalNet: Number.NaN })).toBe(false);
    expect(isPointsState({ ...validState, rewards: [{ ...validState.rewards[0], cost: 0 }] }))
      .toBe(false);
    expect(isPointsState({ ...validState, selectedDate: "2026-02-31" })).toBe(false);
    expect(isPointsState({ ...validState, totalNet: -1 })).toBe(false);
  });

  it("rejects incomplete, unknown, duplicate, or altered configuration", () => {
    expect(isPointsState({ ...validState, tasks: [] })).toBe(false);
    expect(isPointsState({
      ...validState,
      tasks: validState.tasks.map((task, index) =>
        index === 0 ? { ...task, id: "unknown-task" } : task),
    })).toBe(false);
    expect(isPointsState({
      ...validState,
      tasks: validState.tasks.map((task, index) =>
        index === 1 ? { ...validState.tasks[0] } : task),
    })).toBe(false);
    expect(isPointsState({
      ...validState,
      rewards: validState.rewards.map((reward, index) =>
        index === 0 ? { ...reward, cost: reward.cost + 1 } : reward),
    })).toBe(false);
  });
});
```

Create `src/__tests__/api/points-route.test.ts` so the HTTP adapter, rather than only the helper, rejects bad dates:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "test-session" }) }),
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({
  SESSION_COOKIE: "gemsteps-session",
  isConfiguredPin: (value: unknown) => value === "123456",
  isConfiguredSessionSecret: (value: unknown) => typeof value === "string",
  isValidSessionToken: () => true,
}));

import { POST } from "@/app/api/points/route";

const validEvent = {
  id: "event-1",
  type: "task",
  itemId: "seed-task-face",
  points: 1,
  dateKey: "2026-08-25",
  date: "2026-08-25T16:00:00.000Z",
};

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/points validation", () => {
  it.each([
    { ...validEvent, dateKey: "2026-02-31" },
    { ...validEvent, dateKey: "2026-08-24" },
  ])("rejects an impossible or Pacific-mismatched date", async (event) => {
    vi.stubEnv("GEMSTEPS_PIN", "123456");
    vi.stubEnv("GEMSTEPS_SESSION_SECRET", "test-session-secret-at-least-32-chars");
    const response = await POST(new Request("http://localhost/api/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }));

    expect(response.status).toBe(400);
  });
});
```

- [x] **Step 3: Run the tests to prove the boundary modules are missing**

Run:

```bash
npm run test:run -- src/__tests__/lib/point-event.test.ts src/__tests__/lib/points-state.test.ts src/__tests__/api/points-route.test.ts
```

Expected: FAIL because `@/lib/point-event` and `@/lib/points-state` do not exist.

- [x] **Step 4: Implement `point-event.ts`**

Implement the exported surface with this shape:

```ts
import {
  DEFAULT_REWARDS,
  DEFAULT_TASKS,
  MANUAL_ADJUSTMENT_ITEM_ID,
  getDateKeyPT,
  isValidManualAdjustmentPoints,
  type PointEvent,
} from "@/lib/points";

const TASK_POINTS = new Map(DEFAULT_TASKS.map((task) => [task.id, task.defaultPoints]));
const REWARD_COSTS = new Map(DEFAULT_REWARDS.map((reward) => [reward.id, reward.cost]));
const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type PointEventDraft = Pick<PointEvent, "type" | "itemId" | "points">;
export type PointEventOptions = { id?: string; now?: Date };

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const normalized = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  return normalized === value;
}

export function createPointEvent(
  draft: PointEventDraft,
  { id = globalThis.crypto.randomUUID(), now = new Date() }: PointEventOptions = {},
): PointEvent {
  return {
    id,
    ...draft,
    dateKey: getDateKeyPT(now),
    date: now.toISOString(),
  };
}

export function parsePointEvent(value: unknown): PointEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<PointEvent>;
  if (typeof event.id !== "string" || !EVENT_ID_PATTERN.test(event.id)) return null;
  if (typeof event.itemId !== "string" || typeof event.points !== "number") return null;
  if (!Number.isInteger(event.points) || event.points === 0) return null;
  if (typeof event.date !== "string" || !isValidDateKey(event.dateKey)) return null;

  const date = new Date(event.date);
  if (!Number.isFinite(date.getTime()) || getDateKeyPT(date) !== event.dateKey) return null;

  const validItem = event.type === "task"
    ? Math.abs(event.points) === TASK_POINTS.get(event.itemId)
    : event.type === "reward"
      ? Math.abs(event.points) === REWARD_COSTS.get(event.itemId)
      : event.type === "adjustment" &&
        event.itemId === MANUAL_ADJUSTMENT_ITEM_ID &&
        isValidManualAdjustmentPoints(event.points);

  return validItem ? event as PointEvent : null;
}
```

- [x] **Step 5: Implement `points-state.ts`**

Implement structural guards that reject missing, infinite, fractional count, negative count, or non-positive configured values:

```ts
import { isValidDateKey } from "@/lib/point-event";
import { DEFAULT_REWARDS, DEFAULT_TASKS, type PointsState } from "@/lib/points";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
}

function isBaseItem(value: unknown): value is Record<string, unknown> {
  return isRecord(value) &&
    typeof value.id === "string" && value.id.length > 0 &&
    typeof value.title === "string" &&
    typeof value.emoji === "string";
}

export function isPointsState(value: unknown): value is PointsState {
  if (!isRecord(value)) return false;
  if (!isFiniteInteger(value.totalNet) || !isFiniteInteger(value.selectedDateNet)) return false;
  if (value.totalNet < 0) return false;
  if (!isValidDateKey(value.selectedDate)) return false;
  if (!Array.isArray(value.tasks) || !Array.isArray(value.rewards)) return false;

  const validTasks = value.tasks.length === DEFAULT_TASKS.length &&
    value.tasks.every((task, index) => {
      const configured = DEFAULT_TASKS[index];
      return isBaseItem(task) &&
        task.id === configured.id && task.title === configured.title &&
        task.emoji === configured.emoji && task.defaultPoints === configured.defaultPoints &&
        isFiniteInteger(task.completedCount) && task.completedCount >= 0;
    });
  const validRewards = value.rewards.length === DEFAULT_REWARDS.length &&
    value.rewards.every((reward, index) => {
      const configured = DEFAULT_REWARDS[index];
      return isBaseItem(reward) &&
        reward.id === configured.id && reward.title === configured.title &&
        reward.emoji === configured.emoji && reward.cost === configured.cost &&
        isFiniteInteger(reward.redeemedCount) && reward.redeemedCount >= 0;
    });

  return validTasks && validRewards;
}
```

`createPointEvent` is an internal builder for already-selected configured items; `parsePointEvent` remains the trust boundary and must validate every draft field when the event reaches the API.

- [x] **Step 6: Route all event creation and parsing through the shared helpers**

In `src/app/api/points/route.ts`, delete `DATE_KEY_RE`, `TASK_POINTS`, `REWARD_COSTS`, and the local `isValidEvent`; parse the body exactly once:

```ts
const event = parsePointEvent(await req.json().catch(() => null));
if (!event) {
  return NextResponse.json({ error: "Invalid event" }, { status: 400 });
}
```

Replace `parseDateParam` with strict real-date validation:

```ts
function parseDateParam(raw: string | null): string {
  const trimmed = raw?.trim() ?? "";
  return isValidDateKey(trimmed) ? trimmed : getDateKeyPT();
}
```

In every task/reward/adjustment handler in `PointsPage.tsx`, replace the repeated ID/date object literal with:

```ts
const event = createPointEvent({
  type: "task",
  itemId: task.id,
  points: Math.abs(task.defaultPoints),
});
```

Use this exact mapping for all five actions:

| Action | `type` | `itemId` | `points` |
|---|---|---|---|
| Complete task | `task` | `task.id` | `Math.abs(task.defaultPoints)` |
| Undo task | `task` | `task.id` | `-Math.abs(task.defaultPoints)` |
| Redeem reward | `reward` | `reward.id` | `-Math.abs(reward.cost)` |
| Undo reward | `reward` | `reward.id` | `Math.abs(reward.cost)` |
| Manual adjustment | `adjustment` | `MANUAL_ADJUSTMENT_ITEM_ID` | `points` |

Before `storeRemoteState`, validate JSON:

```ts
const body: unknown = await response.json();
if (!isPointsState(body)) throw new Error("服务器返回了无效的积分数据");
return storeRemoteState(body);
```

- [x] **Step 7: Verify the boundary behavior and repository**

Run:

```bash
npm run test:run -- src/__tests__/lib/point-event.test.ts src/__tests__/lib/points-state.test.ts src/__tests__/api/points-route.test.ts
npm run verify
rg -n 'as PointsState|function isValidEvent|DATE_KEY_RE' src/app/PointsPage.tsx src/app/api/points/route.ts
```

Expected: new tests and all prior tests pass; typecheck/build pass; only the two pre-existing date warnings remain; the final boundary-bypass scan is silent.

- [x] **Step 8: Commit the shared boundaries**

Run:

```bash
git add src/lib/point-event.ts src/lib/points-state.ts src/__tests__/lib/point-event.test.ts src/__tests__/lib/points-state.test.ts src/__tests__/api/points-route.test.ts src/app/api/points/route.ts src/app/PointsPage.tsx
git commit -m "refactor: validate point data at boundaries"
```

---

### Task 3: Serialize ledger writes and stop loading the full ledger

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260825000000_add_point_balance/migration.sql`
- Create: `src/lib/server/point-ledger.ts`
- Create: `scripts/run-with-test-database.mjs`
- Modify: `vitest.config.ts`
- Create: `vitest.integration.config.ts`
- Create: `src/__tests__/integration/test-database.ts`
- Create: `src/__tests__/integration/point-ledger.test.ts`
- Modify: `src/app/api/points/route.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: validated `PointEvent`, `DEFAULT_TASKS`, `DEFAULT_REWARDS`, Prisma client, explicit localhost-only `GEMSTEPS_TEST_DATABASE_URL`.
- Produces: guarded test-database commands, `applyPointEventToLedger(db, event): Promise<"applied" | "duplicate" | "rejected">`, and `readPointsState(db, dateKey): Promise<PointsState>`.

- [ ] **Step 1: Build a double-guarded integration-test harness**

Create the owned directories once:

```bash
mkdir -p scripts src/lib/server src/__tests__/integration
```

Create `scripts/run-with-test-database.mjs`. It must not print the URL:

```js
import { spawn } from "node:child_process";

const rawUrl = process.env.GEMSTEPS_TEST_DATABASE_URL;
if (!rawUrl) {
  throw new Error("GEMSTEPS_TEST_DATABASE_URL is required");
}

let parsed;
try {
  parsed = new URL(rawUrl);
} catch {
  throw new Error("GEMSTEPS_TEST_DATABASE_URL must be a valid URL");
}
const databaseName = decodeURIComponent(parsed.pathname.slice(1));
const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
if (
  !["postgres:", "postgresql:"].includes(parsed.protocol) ||
  !allowedHosts.has(parsed.hostname) ||
  !databaseName.endsWith("_test")
) {
  throw new Error("Refusing to use a non-local or non-test database");
}

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A command is required");

const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: rawUrl },
});
child.on("error", (error) => {
  console.error(error.name);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
```

Add these scripts now so every later database command uses the guard:

```json
{
  "scripts": {
    "db:test:migrate": "node scripts/run-with-test-database.mjs npx --no-install prisma migrate deploy",
    "test:integration": "node scripts/run-with-test-database.mjs vitest run --config vitest.integration.config.ts"
  }
}
```

Create `src/__tests__/integration/test-database.ts` with an independent runtime guard and dedicated client; do not import the application's global `@/lib/db` client:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const rawUrl = process.env.GEMSTEPS_TEST_DATABASE_URL;
if (!rawUrl) throw new Error("GEMSTEPS_TEST_DATABASE_URL is required");

let parsed: URL;
try {
  parsed = new URL(rawUrl);
} catch {
  throw new Error("GEMSTEPS_TEST_DATABASE_URL must be a valid URL");
}
const databaseName = decodeURIComponent(parsed.pathname.slice(1));
if (
  !["postgres:", "postgresql:"].includes(parsed.protocol) ||
  !new Set(["localhost", "127.0.0.1", "[::1]"]).has(parsed.hostname) ||
  !databaseName.endsWith("_test")
) {
  throw new Error("Integration tests require a local *_test database");
}

export const testPool = new pg.Pool({ connectionString: rawUrl, max: 5 });
export const testPrisma = new PrismaClient({ adapter: new PrismaPg(testPool) });

export async function closeTestDatabase(): Promise<void> {
  await testPrisma.$disconnect();
  await testPool.end();
}
```

Add this exclusion to the existing `test` object in `vitest.config.ts` immediately, so ordinary unit verification can never discover database tests:

```ts
exclude: ["src/__tests__/integration/**"],
```

Create `vitest.integration.config.ts`:

Create `vitest.integration.config.ts`:

```ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/integration/**/*.test.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

- [ ] **Step 2: Add failing migration, concurrency, and invariant tests**

Create `src/__tests__/integration/point-ledger.test.ts` with real PostgreSQL calls:

```ts
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPointEvent } from "@/lib/point-event";
import { applyPointEventToLedger, readPointsState } from "@/lib/server/point-ledger";
import {
  closeTestDatabase,
  testPool,
  testPrisma,
} from "@/__tests__/integration/test-database";

const now = new Date("2026-08-25T16:00:00.000Z");
const baselineMigration = new URL(
  "../../../prisma/migrations/00000000000000_baseline/migration.sql",
  import.meta.url,
);
const balanceMigration = new URL(
  "../../../prisma/migrations/20260825000000_add_point_balance/migration.sql",
  import.meta.url,
);

beforeEach(async () => {
  await testPrisma.$executeRawUnsafe('TRUNCATE TABLE "PointEntry"');
  await testPrisma.pointBalance.update({
    where: { id: "singleton" },
    data: { totalNet: 0 },
  });
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("serialized point ledger", () => {
  it("runs trigger tests under PostgreSQL Read Committed", async () => {
    const result = await testPool.query<{ default_transaction_isolation: string }>(
      "SHOW default_transaction_isolation",
    );
    expect(result.rows[0]?.default_transaction_isolation).toBe("read committed");
  });

  it("backfills the actual migration from historical entries", async () => {
    const client = await testPool.connect();
    const schema = `migration_${randomUUID().replaceAll("-", "")}`;
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(await readFile(baselineMigration, "utf8"));
      await client.query(`
        INSERT INTO "PointEntry"
          ("id", "type", "itemId", "points", "dateKey", "date")
        VALUES
          ('history-task', 'task', 'seed-task-face', 1, '2026-08-25', NOW()),
          ('history-adjustment', 'adjustment', 'manual-adjustment', 7, '2026-08-25', NOW()),
          ('history-reward', 'reward', 'reward-ice-stick', -5, '2026-08-25', NOW())
      `);
      await client.query(await readFile(balanceMigration, "utf8"));

      const result = await client.query<{ totalNet: number }>(
        'SELECT "totalNet" FROM "PointBalance" WHERE "id" = \'singleton\'',
      );
      expect(result.rows).toEqual([{ totalNet: 3 }]);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      await client.query("SET search_path TO public");
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
    }
  });

  it("allows only one of two concurrent redemptions", async () => {
    await applyPointEventToLedger(testPrisma, createPointEvent(
      { type: "adjustment", itemId: "manual-adjustment", points: 5 },
      { id: "seed-balance", now },
    ));

    const outcomes = await Promise.all([
      applyPointEventToLedger(testPrisma, createPointEvent(
        { type: "reward", itemId: "reward-ice-stick", points: -5 },
        { id: "redeem-a", now },
      )),
      applyPointEventToLedger(testPrisma, createPointEvent(
        { type: "reward", itemId: "reward-ice-stick", points: -5 },
        { id: "redeem-b", now },
      )),
    ]);

    expect(outcomes.sort()).toEqual(["applied", "rejected"]);
    expect(await testPrisma.pointBalance.findUnique({ where: { id: "singleton" } }))
      .toMatchObject({ totalNet: 0 });
  });

  it("allows only one of two concurrent task undos", async () => {
    await applyPointEventToLedger(testPrisma, createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { id: "task-credit", now },
    ));

    const outcomes = await Promise.all([
      applyPointEventToLedger(testPrisma, createPointEvent(
        { type: "task", itemId: "seed-task-face", points: -1 },
        { id: "undo-a", now },
      )),
      applyPointEventToLedger(testPrisma, createPointEvent(
        { type: "task", itemId: "seed-task-face", points: -1 },
        { id: "undo-b", now },
      )),
    ]);

    expect(outcomes.sort()).toEqual(["applied", "rejected"]);
  });

  it("rejects a reward undo when no redemption exists", async () => {
    await applyPointEventToLedger(testPrisma, createPointEvent(
      { type: "adjustment", itemId: "manual-adjustment", points: 5 },
      { id: "seed-balance", now },
    ));
    expect(await applyPointEventToLedger(testPrisma, createPointEvent(
      { type: "reward", itemId: "reward-ice-stick", points: 5 },
      { id: "invalid-reward-undo", now },
    ))).toBe("rejected");
  });

  it("protects invariants for an old-writer direct insert", async () => {
    await testPrisma.pointEntry.create({
      data: {
        id: "seed-adjustment",
        type: "adjustment",
        itemId: "manual-adjustment",
        points: 5,
        dateKey: "2026-08-25",
        date: now,
      },
    });
    await testPrisma.pointEntry.create({
      data: {
        id: "task-credit",
        type: "task",
        itemId: "seed-task-face",
        points: 1,
        dateKey: "2026-08-25",
        date: now,
      },
    });

    const outcomes = await Promise.allSettled(["old-undo-a", "old-undo-b"].map((id) =>
      testPrisma.pointEntry.create({
        data: {
          id,
          type: "task",
          itemId: "seed-task-face",
          points: -1,
          dateKey: "2026-08-25",
          date: now,
        },
      }),
    ));

    expect(outcomes.map((outcome) => outcome.status).sort())
      .toEqual(["fulfilled", "rejected"]);
    expect(await testPrisma.pointBalance.findUnique({ where: { id: "singleton" } }))
      .toMatchObject({ totalNet: 5 });
  });

  it("treats a repeated event ID as idempotent", async () => {
    const event = createPointEvent(
      { type: "adjustment", itemId: "manual-adjustment", points: 5 },
      { id: "same-event", now },
    );

    expect(await applyPointEventToLedger(testPrisma, event)).toBe("applied");
    expect(await applyPointEventToLedger(testPrisma, event)).toBe("duplicate");
    expect(await testPrisma.pointEntry.count({ where: { id: event.id } })).toBe(1);
    expect(await testPrisma.pointBalance.findUnique({ where: { id: "singleton" } }))
      .toMatchObject({ totalNet: 5 });
  });

  it("reads the projection and selected-day aggregates together", async () => {
    await applyPointEventToLedger(testPrisma, createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { id: "task-1", now },
    ));

    const state = await readPointsState(testPrisma, "2026-08-25");

    expect(state).toMatchObject({ totalNet: 1, selectedDateNet: 1 });
    expect(state.tasks.find((task) => task.id === "seed-task-face"))
      .toMatchObject({ completedCount: 1 });
  });
});
```

- [ ] **Step 3: Run the guarded integration test to verify it fails before the model/service exist**

Point `GEMSTEPS_TEST_DATABASE_URL` at a newly created empty local database ending in `_test`; do not reuse a personal/development database. Then run:

```bash
test -n "$GEMSTEPS_TEST_DATABASE_URL"
npm run db:test:migrate
npm run test:integration
```

Expected: the baseline migration deploys, then the integration suite FAILS because `PointBalance` and `@/lib/server/point-ledger` do not exist.

- [ ] **Step 4: Add the projection model and reserve the exact migration path**

Update `prisma/schema.prisma`:

```prisma
model PointEntry {
  id        String   @id
  type      String
  itemId    String
  points    Int
  dateKey   String
  date      DateTime
  createdAt DateTime @default(now())

  @@index([dateKey])
  @@index([dateKey, type, itemId])
}

model PointBalance {
  id        String   @id
  totalNet  Int
  updatedAt DateTime @updatedAt
}
```

Validate the schema and create the deterministic migration directory without applying anything to production:

```bash
test -n "$GEMSTEPS_TEST_DATABASE_URL"
node scripts/run-with-test-database.mjs npx --no-install prisma validate
npx --no-install prisma generate
mkdir -p prisma/migrations/20260825000000_add_point_balance
```

Expected: the updated schema validates, the generated client exposes `pointBalance`, and only the exact migration directory named by this plan is created.

- [ ] **Step 5: Create and review the locked additive migration**

Create `prisma/migrations/20260825000000_add_point_balance/migration.sql` with `apply_patch` and these reviewed operations:

```sql
BEGIN;

-- Block PointEntry writes only for this short migration transaction so no row
-- can land between the backfill and trigger installation.
LOCK TABLE "PointEntry" IN SHARE ROW EXCLUSIVE MODE;

CREATE INDEX "PointEntry_dateKey_type_itemId_idx"
  ON "PointEntry"("dateKey", "type", "itemId");

CREATE TABLE "PointBalance" (
  "id" TEXT NOT NULL,
  "totalNet" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PointBalance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PointBalance_singleton_check" CHECK ("id" = 'singleton'),
  CONSTRAINT "PointBalance_nonnegative_check" CHECK ("totalNet" >= 0)
);

INSERT INTO "PointBalance" ("id", "totalNet", "updatedAt")
SELECT 'singleton', COALESCE(SUM("points"), 0)::INTEGER, CURRENT_TIMESTAMP
FROM "PointEntry";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PointEntry"
    WHERE "type" IN ('task', 'reward')
    GROUP BY "type", "itemId", "dateKey"
    HAVING ("type" = 'task' AND SUM("points") < 0)
      OR ("type" = 'reward' AND SUM("points") > 0)
  ) THEN
    RAISE EXCEPTION 'historical point item aggregate violates invariant'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE FUNCTION "sync_point_balance"() RETURNS TRIGGER AS $$
DECLARE
  item_total INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "PointBalance"
    SET "totalNet" = "totalNet" + NEW."points", "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = 'singleton';

    -- The balance-row update above serializes old and new application writers.
    -- AFTER INSERT can now see NEW plus every earlier committed event.
    IF NEW."type" IN ('task', 'reward') THEN
      SELECT COALESCE(SUM("points"), 0)::INTEGER INTO item_total
      FROM "PointEntry"
      WHERE "type" = NEW."type"
        AND "itemId" = NEW."itemId"
        AND "dateKey" = NEW."dateKey";

      IF (NEW."type" = 'task' AND item_total < 0)
        OR (NEW."type" = 'reward' AND item_total > 0) THEN
        RAISE EXCEPTION 'point item aggregate violates invariant'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE "PointBalance"
    SET "totalNet" = "totalNet" + NEW."points" - OLD."points",
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = 'singleton';
    RETURN NEW;
  ELSE
    UPDATE "PointBalance"
    SET "totalNet" = "totalNet" - OLD."points", "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = 'singleton';
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE TRIGGER "PointEntry_sync_balance"
AFTER INSERT OR UPDATE OR DELETE ON "PointEntry"
FOR EACH ROW EXECUTE FUNCTION "sync_point_balance"();

COMMIT;
```

Expected: the migration accepts a short write-blocking lock, preserves the old single-column index, backfills without a race, and commits only after the trigger is active. Direct inserts from an old application instance are serialized and cannot make the total negative, over-undo a task, or undo a reward that was never redeemed. Keep the trigger explicitly `VOLATILE` and Production at PostgreSQL `READ COMMITTED`: PostgreSQL gives each query executed by a volatile function a fresh snapshot, which is why the post-lock aggregate sees the preceding committed writer ([PostgreSQL function volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html), [SPI visibility](https://www.postgresql.org/docs/current/spi-visibility.html)).

- [ ] **Step 6: Implement the serialized ledger service**

Create `src/lib/server/point-ledger.ts`. The write path must acquire the balance row lock before duplicate and invariant checks:

```ts
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  DEFAULT_REWARDS,
  DEFAULT_TASKS,
  type PointEvent,
  type PointsState,
} from "@/lib/points";

const BALANCE_ID = "singleton";
export type LedgerOutcome = "applied" | "duplicate" | "rejected";

export async function applyPointEventToLedger(
  db: PrismaClient,
  event: PointEvent,
): Promise<LedgerOutcome> {
  return db.$transaction(async (tx) => {
    const [balance] = await tx.$queryRaw<Array<{ totalNet: number }>>`
      SELECT "totalNet"
      FROM "PointBalance"
      WHERE "id" = ${BALANCE_ID}
      FOR UPDATE
    `;
    if (!balance) throw new Error("PointBalance singleton is missing");

    const existing = await tx.pointEntry.findUnique({ where: { id: event.id }, select: { id: true } });
    if (existing) return "duplicate";

    const aggregate = event.type === "adjustment"
      ? null
      : await tx.pointEntry.aggregate({
          where: { type: event.type, itemId: event.itemId, dateKey: event.dateKey },
          _sum: { points: true },
        });
    const nextItemPoints = (aggregate?._sum.points ?? 0) + event.points;
    const nextTotal = balance.totalNet + event.points;
    const invalid = nextTotal < 0 ||
      (event.type === "task" && nextItemPoints < 0) ||
      (event.type === "reward" && nextItemPoints > 0);
    if (invalid) return "rejected";

    await tx.pointEntry.create({
      data: {
        id: event.id,
        type: event.type,
        itemId: event.itemId,
        points: event.points,
        dateKey: event.dateKey,
        date: new Date(event.date),
      },
    });
    return "applied";
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
```

In the same module implement `readPointsState`. Read the singleton balance and a date-filtered groupBy, then map aggregates onto the configured tasks/rewards:

```ts
export async function readPointsState(db: PrismaClient, selectedDate: string): Promise<PointsState> {
  return db.$transaction(async (tx) => {
    const balance = await tx.pointBalance.findUniqueOrThrow({
      where: { id: BALANCE_ID },
      select: { totalNet: true },
    });
    const groups = await tx.pointEntry.groupBy({
      by: ["type", "itemId"],
      where: { dateKey: selectedDate },
      _sum: { points: true },
    });

    let selectedDateNet = 0;
    const taskPoints = new Map<string, number>();
    const rewardPoints = new Map<string, number>();
    for (const group of groups) {
      const points = group._sum.points ?? 0;
      selectedDateNet += points;
      if (group.type === "task") taskPoints.set(group.itemId, points);
      if (group.type === "reward") rewardPoints.set(group.itemId, points);
    }

    return {
      totalNet: balance.totalNet,
      selectedDate,
      selectedDateNet,
      tasks: DEFAULT_TASKS.map((task) => ({
        ...task,
        completedCount: Math.max(0, Math.round((taskPoints.get(task.id) ?? 0) / task.defaultPoints)),
      })),
      rewards: DEFAULT_REWARDS.map((reward) => ({
        ...reward,
        redeemedCount: Math.max(0, Math.round(-(rewardPoints.get(reward.id) ?? 0) / reward.cost)),
      })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
```

- [ ] **Step 7: Make the route a thin HTTP adapter**

In `src/app/api/points/route.ts`:

- keep `requireSession` and date-query parsing;
- call `readPointsState(prisma, selectedDate)` in GET;
- call `applyPointEventToLedger(prisma, event)` in POST;
- return 409 only for `rejected` and 204 for `applied` or `duplicate`;
- remove both unfiltered `findMany` calls and both in-route reductions.

Keep the guarded integration scripts and ordinary-test exclusion from Step 1 unchanged.

- [ ] **Step 8: Apply the migration to the disposable database and run red-to-green verification**

Run:

```bash
test -n "$GEMSTEPS_TEST_DATABASE_URL"
npm run db:test:migrate
npx --no-install prisma generate
npm run test:integration
npm run verify
```

Expected: the actual migration backfills historical rows; old-writer trigger and app-service tests protect total/task/reward invariants; concurrent redemption and task undo each produce one applied and one rejected event; duplicate test stores one row; all unit tests/build pass.

- [ ] **Step 9: Confirm full-ledger reads are gone**

Run:

```bash
rg -n 'pointEntry\.findMany' src
```

Expected: no output. Confirm `PointEntry_dateKey_type_itemId_idx`, the `PointEntry` write lock, the nonnegative check, and trigger invariant query exist in the hand-written migration.

- [ ] **Step 10: Commit the ledger fix**

Run:

```bash
git add prisma/schema.prisma prisma/migrations src/lib/server/point-ledger.ts src/app/api/points/route.ts scripts/run-with-test-database.mjs src/__tests__/integration/test-database.ts src/__tests__/integration/point-ledger.test.ts vitest.config.ts vitest.integration.config.ts package.json package-lock.json
git commit -m "fix: serialize point ledger updates"
```

---

### Task 4: Replace the PIN-derived permanent token and make offline lock sticky

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/lib/offline-auth.ts`
- Modify: `src/app/api/auth/route.ts`
- Modify: `src/app/api/points/route.ts`
- Modify: `src/app/ProtectedApp.tsx`
- Modify: `src/__tests__/lib/auth.test.ts`
- Create: `src/__tests__/lib/offline-auth.test.ts`
- Create: `src/__tests__/api/auth-route.test.ts`
- Create: `src/__tests__/app/ProtectedApp.test.tsx`
- Modify: `README.md`
- Create: `docs/security-and-operations.md`

**Interfaces:**
- Consumes: configured six-digit `GEMSTEPS_PIN`, required `GEMSTEPS_SESSION_SECRET` containing at least 32 random bytes, localStorage.
- Produces: `createSessionToken(options)`, `isValidSessionToken(options)`, `markExplicitlyLocked(storage)`, `markUnlocked(storage, expiresAt)`, `hasOfflineSession(storage, now)`, and `isExplicitlyLocked(storage)`.

- [ ] **Step 1: Replace auth tests with explicit expiration and secret cases**

Extend `src/__tests__/lib/auth.test.ts` so the token test asserts all security properties:

```ts
it("signs an expiring token with a high-entropy secret", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const expiresAt = Date.parse("2026-09-24T00:00:00.000Z");
  const token = createSessionToken({ configuredPin: "482731", sessionSecret: secret, expiresAt });

  expect(isValidSessionToken({
    token,
    configuredPin: "482731",
    sessionSecret: secret,
    now: expiresAt - 1,
  })).toBe(true);
  expect(isValidSessionToken({
    token,
    configuredPin: "482731",
    sessionSecret: secret,
    now: expiresAt,
  })).toBe(false);
  expect(isValidSessionToken({
    token,
    configuredPin: "482730",
    sessionSecret: secret,
    now: expiresAt - 1,
  })).toBe(false);
  expect(isValidSessionToken({
    token,
    configuredPin: "482731",
    sessionSecret: `${secret}x`,
    now: expiresAt - 1,
  })).toBe(false);
  expect(isValidSessionToken({
    token: `${token}.suffix`,
    configuredPin: "482731",
    sessionSecret: secret,
    now: expiresAt - 1,
  })).toBe(false);
});

it("requires at least 32 bytes of session secret", () => {
  expect(isConfiguredSessionSecret("short")).toBe(false);
  expect(isConfiguredSessionSecret("0123456789abcdef0123456789abcdef")).toBe(true);
});
```

Create `src/__tests__/api/auth-route.test.ts` so the route itself is held to the new token contract:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

import { GET, POST } from "@/app/api/auth/route";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isValidSessionToken,
} from "@/lib/auth";

const SESSION_SECRET = "0123456789abcdef0123456789abcdef";
const NOW = Date.parse("2026-08-25T16:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("GEMSTEPS_PIN", "482731");
  vi.stubEnv("GEMSTEPS_SESSION_SECRET", SESSION_SECRET);
  cookieGet.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("auth route sessions", () => {
  it("returns and signs one shared absolute expiration", async () => {
    const response = await POST(new Request("http://localhost/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "482731" }),
    }));
    const body = await response.json();
    const token = response.cookies.get(SESSION_COOKIE)?.value;

    expect(body.expiresAt).toBe(NOW + SESSION_MAX_AGE_SECONDS * 1_000);
    expect(isValidSessionToken({
      token,
      configuredPin: "482731",
      sessionSecret: SESSION_SECRET,
      now: body.expiresAt - 1,
    })).toBe(true);
  });

  it("reports an embedded-expiration token as unauthenticated", async () => {
    const token = createSessionToken({
      configuredPin: "482731",
      sessionSecret: SESSION_SECRET,
      expiresAt: NOW - 1,
    });
    cookieGet.mockReturnValue({ value: token });

    const response = await GET();

    expect(await response.json()).toMatchObject({ authenticated: false, configured: true });
  });
});
```

- [ ] **Step 2: Add failing explicit-lock tests**

Create the component-test directory once:

```bash
mkdir -p src/__tests__/app
```

Create `src/__tests__/lib/offline-auth.test.ts` using a minimal in-memory Storage implementation:

```ts
import { describe, expect, it } from "vitest";
import {
  hasOfflineSession,
  isExplicitlyLocked,
  markExplicitlyLocked,
  markUnlocked,
} from "@/lib/offline-auth";

function storage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("offline auth state", () => {
  it("keeps an explicit lock until a successful unlock", () => {
    const local = storage();
    markUnlocked(local, 2_000);
    expect(hasOfflineSession(local, 1_000)).toBe(true);

    markExplicitlyLocked(local);
    expect(isExplicitlyLocked(local)).toBe(true);
    expect(hasOfflineSession(local, 1_000)).toBe(false);

    markUnlocked(local, 3_000);
    expect(isExplicitlyLocked(local)).toBe(false);
    expect(hasOfflineSession(local, 2_000)).toBe(true);
  });
});
```

Create `src/__tests__/app/ProtectedApp.test.tsx` to prove the component honors the helper before it trusts the online cookie:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EXPLICIT_LOCK_KEY, OFFLINE_AUTH_KEY } from "@/lib/offline-auth";

vi.mock("@/app/PointsPage", () => ({
  default: () => <div>points-unlocked</div>,
}));

import ProtectedApp from "@/app/ProtectedApp";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("ProtectedApp sticky lock", () => {
  it("shows the PIN screen without trusting or fetching an online cookie", async () => {
    window.localStorage.setItem(EXPLICIT_LOCK_KEY, "1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProtectedApp />);

    expect(await screen.findByText("请输入密码")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the explicit lock only after a successful PIN submission", async () => {
    const expiresAt = Date.now() + 60_000;
    window.localStorage.setItem(EXPLICIT_LOCK_KEY, "1");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ authenticated: true, expiresAt }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ProtectedApp />);
    fireEvent.change(await screen.findByLabelText("六位数字密码"), {
      target: { value: "123456" },
    });

    expect(await screen.findByText("points-unlocked")).toBeTruthy();
    await waitFor(() => {
      expect(window.localStorage.getItem(EXPLICIT_LOCK_KEY)).toBeNull();
      expect(window.localStorage.getItem(OFFLINE_AUTH_KEY)).toBe(String(expiresAt));
    });
  });
});
```

The successful PIN POST is the sole action that clears the explicit lock and writes the new offline expiration.

- [ ] **Step 3: Run focused tests to verify the new APIs are absent**

Run:

```bash
npm run test:run -- src/__tests__/lib/auth.test.ts src/__tests__/lib/offline-auth.test.ts src/__tests__/api/auth-route.test.ts src/__tests__/app/ProtectedApp.test.tsx
```

Expected: FAIL on missing session option signatures and missing offline-auth module.

- [ ] **Step 4: Implement the expiring token format**

In `src/lib/auth.ts`, keep PIN validation and replace token creation/validation with:

```ts
const SESSION_VERSION = "1";

export function isConfiguredSessionSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && Buffer.byteLength(secret, "utf8") >= 32;
}

type CreateSessionTokenOptions = {
  configuredPin: string;
  sessionSecret: string;
  expiresAt: number;
};

type ValidateSessionTokenOptions = {
  token: string | undefined;
  configuredPin: string;
  sessionSecret: string;
  now?: number;
};

function signature(payload: string, configuredPin: string, sessionSecret: string): string {
  return createHmac("sha256", sessionSecret)
    .update(`${SESSION_SCOPE}:${configuredPin}:${payload}`)
    .digest("base64url");
}

export function createSessionToken({
  configuredPin,
  sessionSecret,
  expiresAt,
}: CreateSessionTokenOptions): string {
  if (!isConfiguredPin(configuredPin)) throw new Error("GEMSTEPS_PIN must be exactly six digits");
  if (!isConfiguredSessionSecret(sessionSecret)) {
    throw new Error("GEMSTEPS_SESSION_SECRET must contain at least 32 bytes");
  }
  if (!Number.isSafeInteger(expiresAt)) throw new Error("Session expiration is invalid");

  const payload = `${SESSION_VERSION}.${expiresAt}`;
  return `${payload}.${signature(payload, configuredPin, sessionSecret)}`;
}

export function isValidSessionToken({
  token,
  configuredPin,
  sessionSecret,
  now = Date.now(),
}: ValidateSessionTokenOptions): boolean {
  if (!token || !isConfiguredPin(configuredPin) || !isConfiguredSessionSecret(sessionSecret)) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, rawExpiresAt, received] = parts;
  const expiresAt = Number(rawExpiresAt);
  if (version !== SESSION_VERSION || !Number.isSafeInteger(expiresAt) || expiresAt <= now || !received) {
    return false;
  }

  const payload = `${version}.${expiresAt}`;
  const expected = signature(payload, configuredPin, sessionSecret);
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer);
}
```

- [ ] **Step 5: Implement local explicit-lock helpers**

Create `src/lib/offline-auth.ts`:

```ts
export const OFFLINE_AUTH_KEY = "gemsteps-unlocked-until";
export const EXPLICIT_LOCK_KEY = "gemsteps-explicitly-locked";

type LocalStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function isExplicitlyLocked(storage: LocalStorage): boolean {
  return storage.getItem(EXPLICIT_LOCK_KEY) === "1";
}

export function hasOfflineSession(storage: LocalStorage, now = Date.now()): boolean {
  if (isExplicitlyLocked(storage)) return false;
  const expiresAt = Number(storage.getItem(OFFLINE_AUTH_KEY));
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function markExplicitlyLocked(storage: LocalStorage): void {
  storage.setItem(EXPLICIT_LOCK_KEY, "1");
  storage.removeItem(OFFLINE_AUTH_KEY);
}

export function markUnlocked(storage: LocalStorage, expiresAt: number): void {
  storage.removeItem(EXPLICIT_LOCK_KEY);
  storage.setItem(OFFLINE_AUTH_KEY, String(expiresAt));
}
```

- [ ] **Step 6: Require the secret in both API routes**

In `src/app/api/auth/route.ts` and the session guard used by `src/app/api/points/route.ts`, load both variables and return 503 when either is invalid:

```ts
const configuredPin = process.env.GEMSTEPS_PIN;
const sessionSecret = process.env.GEMSTEPS_SESSION_SECRET;
if (!isConfiguredPin(configuredPin) || !isConfiguredSessionSecret(sessionSecret)) {
  return NextResponse.json({ error: "GemSteps authentication is not configured" }, { status: 503 });
}
```

On successful PIN submission, calculate one expiration and use it for both body and token:

```ts
const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
const token = createSessionToken({ configuredPin, sessionSecret, expiresAt });
```

Set both `expires: new Date(expiresAt)` and `maxAge: SESSION_MAX_AGE_SECONDS` on the cookie, and return that same `expiresAt` in the response body. Pass `token`, PIN, secret, and current time to the new validation function for GET and points authorization.

- [ ] **Step 7: Enforce explicit lock before online session checking**

In `ProtectedApp.tsx`, remove the local constants/helper and use `offline-auth.ts`. At the beginning of `checkSession`:

```ts
if (isExplicitlyLocked(window.localStorage)) {
  if (!cancelled) setAuthState("locked");
  return;
}
```

On successful PIN submission call `markUnlocked(window.localStorage, expiresAt)`. On lock call `markExplicitlyLocked(window.localStorage)` before changing React state or sending DELETE. In the network-error path call `hasOfflineSession(window.localStorage)`.

- [ ] **Step 8: Document random secret creation and mandatory WAF rules**

Add `GEMSTEPS_SESSION_SECRET` to README required environment and document this generation command without showing any generated result:

```bash
openssl rand -base64 32
```

State that length validation is only a minimum guard and cannot measure entropy; operators must use at least 32 random bytes. Create `docs/security-and-operations.md` with these two production rules:

```text
Name: gemsteps-auth-pin-ip-limit
Condition: Request Path equals /api/auth AND Request Method equals POST
Action: Rate Limit
Algorithm: Fixed Window
Window: 60 seconds
Limit: 5 requests
Key: IP
Response: 429

Name: gemsteps-auth-pin-ja4-limit
Condition: Request Path equals /api/auth AND Request Method equals POST
Action: Rate Limit
Algorithm: Fixed Window
Window: 60 seconds
Limit: 5 requests
Key: JA4 Digest
Response: 429
```

State that both rules are mandatory before exposing the auth code in Production: observe matching Preview traffic in Log mode, capture evidence, then publish both in Rate Limit mode before the production deployment. Execution requires explicit external-change authorization. Also record the accepted limitation that local lock/DELETE does not revoke a copied token; PIN or secret rotation invalidates all outstanding tokens, otherwise a copied token lasts until its embedded expiration.

- [ ] **Step 9: Verify auth and lock behavior**

Run:

```bash
npm run test:run -- src/__tests__/lib/auth.test.ts src/__tests__/lib/offline-auth.test.ts src/__tests__/api/auth-route.test.ts src/__tests__/app/ProtectedApp.test.tsx
npm run verify
rg -n 'createHmac\("sha256", configuredPin\)|gemsteps-explicitly-locked' src
```

Expected: focused and full verification pass; no PIN-derived HMAC key remains; explicit lock is referenced by the shared helper and `ProtectedApp`.

- [ ] **Step 10: Commit auth hardening**

Run:

```bash
git add src/lib/auth.ts src/lib/offline-auth.ts src/app/api/auth/route.ts src/app/api/points/route.ts src/app/ProtectedApp.tsx src/__tests__/lib/auth.test.ts src/__tests__/lib/offline-auth.test.ts src/__tests__/api/auth-route.test.ts src/__tests__/app/ProtectedApp.test.tsx README.md docs/security-and-operations.md
git commit -m "fix: harden PIN sessions and local lock"
```

---

### Task 5: Collapse IndexedDB to one current snapshot and remove dead date navigation

**Files:**
- Modify: `src/lib/offline-db.ts`
- Modify: `src/app/PointsPage.tsx`
- Modify: `src/lib/points.ts`
- Modify: `src/__tests__/lib/offline.test.ts`
- Modify: `src/__tests__/lib/points.test.ts`

**Interfaces:**
- Consumes: existing Dexie `snapshots` and `outbox` stores, including legacy snapshots whose keys are date strings.
- Produces: one snapshot record with key `current`; public `loadSnapshot`, `storeRemoteState`, and `enqueuePointEvent` signatures stay unchanged.

- [ ] **Step 1: Add failing one-snapshot migration tests**

Extend `offline.test.ts` with:

```ts
it("migrates legacy date snapshots to one current snapshot", async () => {
  await offlineDb.table("snapshots").bulkPut([
    { key: "2026-08-20", state: state("2026-08-20") },
    { key: "2026-08-21", state: { ...state("2026-08-21"), totalNet: 12 } },
  ]);

  const current = await loadSnapshot("2026-08-22");

  expect(current).toMatchObject({ selectedDate: "2026-08-22", totalNet: 12 });
  expect(await offlineDb.snapshots.count()).toBe(1);
  expect(await offlineDb.snapshots.get("current")).toBeDefined();
});

it("removes a legacy record even when current already exists", async () => {
  await offlineDb.table("snapshots").bulkPut([
    { key: "current", state: state("2026-08-20") },
    { key: "2026-08-20", state: { ...state("2026-08-20"), totalNet: 99 } },
  ]);

  const current = await loadSnapshot("2026-08-20");

  expect(await offlineDb.snapshots.count()).toBe(1);
  expect(current?.totalNet).toBe(10);
});

it("rolls back an older-date rejection without changing current-day counts", async () => {
  await storeRemoteState(state("2026-08-20"));
  await enqueuePointEvent(taskEvent());
  await loadSnapshot("2026-08-21");

  const result = await drainOutbox({
    fetchImpl: vi.fn(async () => new Response(null, { status: 409 })),
  });
  const current = await loadSnapshot("2026-08-21");

  expect(result).toEqual({ completed: true, rejected: 1 });
  expect(current).toMatchObject({
    totalNet: 10,
    selectedDate: "2026-08-21",
    selectedDateNet: 0,
    tasks: [{ completedCount: 0 }],
  });
});

it("merges an older-date pending event into a current-day remote snapshot", async () => {
  await storeRemoteState(state("2026-08-20"));
  await enqueuePointEvent(taskEvent());
  await loadSnapshot("2026-08-21");

  const merged = await storeRemoteState({
    ...state("2026-08-21"),
    selectedDateNet: 0,
  });

  expect(merged).toMatchObject({
    totalNet: 11,
    selectedDate: "2026-08-21",
    selectedDateNet: 0,
    tasks: [{ completedCount: 0 }],
  });
});
```

- [ ] **Step 2: Run the focused test and observe the legacy records remain**

Run:

```bash
npm run test:run -- src/__tests__/lib/offline.test.ts
```

Expected: FAIL because snapshots remain keyed by date and count is greater than one.

- [ ] **Step 3: Make `current` the only snapshot key**

In `offline-db.ts`:

```ts
const CURRENT_SNAPSHOT_KEY = "current";

function snapshotRecord(state: PointsState): SnapshotRecord {
  return { key: CURRENT_SNAPSHOT_KEY, state };
}
```

Implement `loadSnapshot` as one serialized read/derive/write transaction plus a lazy migration:

```ts
export async function loadSnapshot(dateKey: string): Promise<PointsState | null> {
  return offlineDb.transaction("rw", offlineDb.snapshots, async () => {
    const current = await offlineDb.snapshots.get(CURRENT_SNAPSHOT_KEY);
    if (current) {
      const selected = current.state.selectedDate === dateKey
        ? current.state
        : deriveStateForDate(current.state, dateKey);
      await offlineDb.snapshots.clear();
      await offlineDb.snapshots.put(snapshotRecord(selected));
      return selected;
    }

    const legacy = (await offlineDb.snapshots.toArray())
      .filter((record) => record.key !== CURRENT_SNAPSHOT_KEY)
      .sort((left, right) => left.key.localeCompare(right.key))
      .at(-1);
    if (!legacy) return null;

    const migrated = legacy.state.selectedDate === dateKey
      ? legacy.state
      : deriveStateForDate(legacy.state, dateKey);
    await offlineDb.snapshots.clear();
    await offlineDb.snapshots.put(snapshotRecord(migrated));
    return migrated;
  });
}
```

Replace the three multi-snapshot write paths with these exact single-snapshot transactions:

```ts
export async function storeRemoteState(state: PointsState): Promise<PointsState> {
  return offlineDb.transaction("rw", offlineDb.snapshots, offlineDb.outbox, async () => {
    let merged = state;
    for (const record of await pendingEvents()) {
      merged = applyPointEvent(merged, record.event);
    }
    await offlineDb.snapshots.clear();
    await offlineDb.snapshots.put(snapshotRecord(merged));
    return merged;
  });
}

export async function enqueuePointEvent(event: PointEvent): Promise<PointsState> {
  return offlineDb.transaction("rw", offlineDb.snapshots, offlineDb.outbox, async () => {
    const current = await offlineDb.snapshots.get(CURRENT_SNAPSHOT_KEY);
    if (!current) throw new Error("No local snapshot is available");

    const base = current.state.selectedDate === event.dateKey
      ? current.state
      : deriveStateForDate(current.state, event.dateKey);
    const optimistic = applyPointEvent(base, event);
    await offlineDb.snapshots.put(snapshotRecord(optimistic));

    const latestOutboxRecord = await offlineDb.outbox.orderBy("order").last();
    await offlineDb.outbox.add({
      id: event.id,
      order: (latestOutboxRecord?.order ?? 0) + 1,
      event,
    });
    return optimistic;
  });
}

export async function rejectOutboxEvent(record: OutboxRecord): Promise<void> {
  await offlineDb.transaction("rw", offlineDb.snapshots, offlineDb.outbox, async () => {
    const current = await offlineDb.snapshots.get(CURRENT_SNAPSHOT_KEY);
    if (current) {
      await offlineDb.snapshots.put(
        snapshotRecord(applyPointEvent(current.state, record.event, -1)),
      );
    }
    await offlineDb.outbox.delete(record.id);
  });
}
```

- [ ] **Step 4: Remove constant-zero date navigation state**

In `PointsPage.tsx`:

- remove `selectedDateOffset`, `handlePreviousDate`, and `handleNextDate`;
- set `selectedDateKey` directly from `todayDateKey`;
- replace `isCurrentDate` checks with current-date behavior rather than retaining a constant boolean;
- remove the now-unused `addDaysToDateKey` import.

After `rg` confirms there is no production caller, remove `addDaysToDateKey` from `points.ts` and delete only its dedicated test case from `points.test.ts`.

- [ ] **Step 5: Verify migration, outbox, and lint cleanliness**

Run:

```bash
npm run test:run -- src/__tests__/lib/offline.test.ts src/__tests__/lib/points.test.ts
npm run lint
npm run typecheck
npm run build
rg -n 'selectedDateOffset|handlePreviousDate|handleNextDate|addDaysToDateKey' src
```

Expected: all tests/build pass; ESLint has zero warnings; final `rg` prints no matches.

- [ ] **Step 6: Commit the offline simplification**

Run:

```bash
git add src/lib/offline-db.ts src/app/PointsPage.tsx src/lib/points.ts src/__tests__/lib/offline.test.ts src/__tests__/lib/points.test.ts
git commit -m "refactor: keep one offline points snapshot"
```

---

### Task 6: Make `PwaUpdater` the only service-worker update controller

**Files:**
- Modify: `src/app/PwaUpdater.tsx`
- Modify: `src/app/PointsPage.tsx`
- Create: `src/__tests__/app/PwaUpdater.test.ts`

**Interfaces:**
- Consumes: Serwist registration at scope `/`, browser focus/online/visibility events.
- Produces: one non-overlapping update controller that checks immediately and hourly while visible, then reloads once on `controllerchange`.

- [ ] **Step 1: Capture the duplicate behavior in a source assertion**

Run:

```bash
rg -n 'registration\.update|controllerchange|SKIP_WAITING' src/app/PwaUpdater.tsx src/app/PointsPage.tsx
```

Expected: update logic appears in both files and `SKIP_WAITING` appears in `PointsPage.tsx`.

- [ ] **Step 2: Add a tested one-reload state machine**

Export this small handler from `PwaUpdater.tsx` and use it inside the effect:

```ts
export function createControllerChangeHandler(
  hasExistingController: boolean,
  reload: () => void,
): () => void {
  let hasController = hasExistingController;
  let reloading = false;
  return () => {
    if (!hasController) {
      hasController = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    reload();
  };
}
```

Create `src/__tests__/app/PwaUpdater.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createControllerChangeHandler } from "@/app/PwaUpdater";

describe("PWA controller changes", () => {
  it("does not reload for first installation and reloads once afterward", () => {
    const reload = vi.fn();
    const changed = createControllerChangeHandler(false, reload);
    changed();
    changed();
    changed();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads once when an existing controller is replaced", () => {
    const reload = vi.fn();
    const changed = createControllerChangeHandler(true, reload);
    changed();
    changed();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Add an hourly, non-overlapping update check to `PwaUpdater`**

Replace the effect-local reload state with the tested handler, add an in-flight guard, and register the interval only after `checkWhenVisible` is defined:

```ts
const UPDATE_INTERVAL_MS = 60 * 60 * 1_000;

const reloadForNewVersion = createControllerChangeHandler(
  navigator.serviceWorker.controller !== null,
  () => window.location.reload(),
);

let checkInProgress = false;
const checkForUpdate = async () => {
  if (!window.navigator.onLine || checkInProgress) return;
  checkInProgress = true;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    await registration?.update();
  } catch {
    // Foreground, online, or the next hourly event retries.
  } finally {
    checkInProgress = false;
  }
};

const checkWhenVisible = () => {
  if (!document.hidden) void checkForUpdate();
};

const interval = window.setInterval(checkWhenVisible, UPDATE_INTERVAL_MS);

return () => {
  window.clearInterval(interval);
  navigator.serviceWorker.removeEventListener("controllerchange", reloadForNewVersion);
  window.removeEventListener("focus", checkWhenVisible);
  window.removeEventListener("online", checkWhenVisible);
  document.removeEventListener("visibilitychange", checkWhenVisible);
};
```

Keep the existing immediate check and focus/online/visibility listeners. The hourly interval is an intentional freshness/battery tradeoff for a continuously visible installed app; do not restore 10-second service-worker polling.

- [ ] **Step 4: Delete PWA lifecycle code from `PointsPage`**

Remove `updateCheckInProgressRef`, `checkForCodeUpdate`, its calls, waiting/installing worker listeners, and the `SKIP_WAITING` message. Keep the 10-second data-refresh interval and its online/focus/visibility behavior; its callback should only refresh the Pacific date and call `syncAndRefresh`.

- [ ] **Step 5: Verify one owner, reload behavior, and production compilation**

Run:

```bash
rg -n 'registration\.update|controllerchange|SKIP_WAITING' src/app/PwaUpdater.tsx src/app/PointsPage.tsx
npm run test:run -- src/__tests__/app/PwaUpdater.test.ts
npm run verify
```

Expected: `registration.update` and `controllerchange` occur only in `PwaUpdater`; `SKIP_WAITING` has no source match; all verification passes.

- [ ] **Step 6: Commit the PWA consolidation**

Run:

```bash
git add src/app/PwaUpdater.tsx src/app/PointsPage.tsx src/__tests__/app/PwaUpdater.test.ts
git commit -m "refactor: centralize PWA update checks"
```

---

### Task 7: Split `PointsPage` by behavior and presentation

**Files:**
- Create: `src/app/points/usePointsController.ts`
- Create: `src/app/points/TaskSection.tsx`
- Create: `src/app/points/RewardSection.tsx`
- Create: `src/app/points/PointAdjustmentDialog.tsx`
- Create: `src/app/points/CelebrationOverlay.tsx`
- Modify: `src/app/PointsPage.tsx`
- Create: `src/__tests__/app/usePointsController.test.tsx`

**Interfaces:**
- Consumes: `PointsState`, task/reward types, offline database functions, `drainOutbox`, and `createPointEvent`.
- Produces: `usePointsController(): PointsController`; presentational components receive plain domain values and callback props, with no persistence/network imports; `PointsPage` remains the default export consumed by `ProtectedApp`.

- [ ] **Step 1: Define the controller contract before moving code**

Create the feature directory once:

```bash
mkdir -p src/app/points
```

At the top of `usePointsController.ts`, define and export:

```ts
import type { PointsState } from "@/lib/points";

export type PointsController = {
  data: PointsState | null;
  loading: boolean;
  errorMessage: string | null;
  totalPoints: number;
  displayedPoints: number;
  todayDateKey: string;
  selectedDateDateLabel: string;
  selectedDateName: string;
  enqueueTask: (taskId: string, undo: boolean) => Promise<boolean>;
  enqueueReward: (rewardId: string, undo: boolean) => Promise<boolean>;
  enqueueAdjustment: (points: number) => Promise<boolean>;
};
```

The controller owns data state, initial load, remote validation, snapshot merge, outbox drain, 10-second data refresh, midnight rollover, displayed-point animation, and event creation. It does not render JSX or own `activeTab`, `undoMode`, dialog-open state, lock behavior, or celebration DOM.

- [ ] **Step 2: Move task and reward presentation without behavior changes**

Move `ChoreTile` and `TaskSection` to `TaskSection.tsx`. Export this exact prop contract:

```ts
export type TaskSectionProps = {
  tasks: TaskProgress[];
  readOnly: boolean;
  isUndoMode: boolean;
  onTap: (id: string) => void;
};
```

Move `RewardTile` and `RewardSection` to `RewardSection.tsx` with:

```ts
export type RewardSectionProps = {
  rewards: PointsState["rewards"];
  currentPoints: number;
  disabled: boolean;
  isUndoMode: boolean;
  onRedeem: (id: string) => void;
};
```

Preserve all classes, dimensions, labels, disabled rules, and displayed counts.

- [ ] **Step 3: Move dialog and celebration presentation**

Move `PointAdjustmentDialog` unchanged except for exporting it and its props:

```ts
export type PointAdjustmentDialogProps = {
  totalPoints: number;
  onClose: () => void;
  onAdjust: (points: number) => Promise<boolean>;
};
```

Move `RainParticle`, animation styles, and overlay JSX to `CelebrationOverlay.tsx`:

```ts
export type Celebration = { emoji: string; value: number };
export type CelebrationOverlayProps = { celebration: Celebration | null };
```

Keep the timer that clears celebration in `PointsPage`, because it is page interaction state rather than persistent point data.

- [ ] **Step 4: Move load/sync/action logic into `usePointsController`**

Move the existing state/effects/callbacks behind the contract from Step 1. Consolidate task/reward event differences inside the controller so `PointsPage` calls:

```ts
void controller.enqueueTask(taskId, undoMode);
void controller.enqueueReward(rewardId, undoMode);
```

The controller must look up the configured item from `data`, reject invalid undo/redeem actions before enqueueing, call `enqueuePointEvent`, apply the optimistic state, and trigger `syncAndRefresh`. It returns `true` only when the local Dexie transaction succeeds.

- [ ] **Step 5: Reduce `PointsPage` to composition and page-only interaction state**

`PointsPage` should retain only:

```ts
const [activeTab, setActiveTab] = useState<TabKey>("tasks");
const [undoMode, setUndoMode] = useState(false);
const [adjustmentOpen, setAdjustmentOpen] = useState(false);
const [celebration, setCelebration] = useState<Celebration | null>(null);
const controller = usePointsController();
```

It renders loading/error/header/tabs, imported sections, imported dialog, imported overlay, and the lock button. Preserve celebration timing and invoke it after successful controller actions.

- [ ] **Step 6: Add controller lifecycle regression tests**

Create `src/__tests__/app/usePointsController.test.tsx` with `// @vitest-environment jsdom`, `renderHook`, `act`, and `waitFor` from `@testing-library/react`. Mock `@/lib/offline-db` and `@/lib/sync-controller` at their module boundaries and use complete `DEFAULT_TASKS`/`DEFAULT_REWARDS` fixtures accepted by `isPointsState`. Implement these exact cases:

1. `loadSnapshot` resolves immediately and a deferred remote fetch resolves later; assert the hook exposes cached data first and validated remote data second.
2. A remote response missing `tasks` (and a separate response with an unknown task ID) leaves the cached state unchanged, sets the stable invalid-response error, and never calls `storeRemoteState`.
3. With `navigator.onLine = false`, `enqueueTask("seed-task-face", false)` writes one event through `enqueuePointEvent`, updates `data` to the mocked optimistic state, and does not call remote fetch.
4. A mocked `drainOutbox` result `{ completed: true, rejected: 1 }` is followed by the authoritative remote state; assert the rejected optimistic value is not retained.
5. With fake timers and `getChangedDateKeyPT` mocked to return the next Pacific date, advance the data-refresh interval once and assert the hook requests the new date snapshot.
6. Unmount the hook, advance all timers, and assert no further snapshot, fetch, or outbox call occurs and `vi.getTimerCount()` is zero after cleanup.

Run:

```bash
npm run test:run -- src/__tests__/app/usePointsController.test.tsx
```

Expected: PASS without a real network, IndexedDB database, or service worker; every hook-owned effect has an observable cleanup assertion.

- [ ] **Step 7: Verify behavior and file boundaries**

Run:

```bash
npm run verify
wc -l src/app/PointsPage.tsx src/app/points/*.tsx src/app/points/usePointsController.ts
rg -n 'offlineDb|loadSnapshot|storeRemoteState|enqueuePointEvent|drainOutbox|\bfetch\b|serviceWorker|registration\.update' src/app/PointsPage.tsx
```

Expected: all verification passes; `PointsPage.tsx` is below 300 lines; it contains no Dexie, outbox, fetch, or service-worker implementation references; each new file has one responsibility.

Point `GEMSTEPS_TEST_DATABASE_URL` at a newly created empty local database ending in `_test`, migrate it without resetting any database, and perform the local browser smoke check on `localhost`:

```bash
test -n "$GEMSTEPS_TEST_DATABASE_URL"
test -n "$GEMSTEPS_PIN"
test -n "$GEMSTEPS_SESSION_SECRET"
npm run db:test:migrate
node scripts/run-with-test-database.mjs npm run dev
```

```text
1. Enter the PIN and confirm tasks/rewards load.
2. Add and undo a task.
3. Redeem and undo a reward with sufficient balance.
4. Add and subtract a manual adjustment.
5. Switch offline, add a task, reload, reconnect, and confirm outbox drain.
6. Click lock offline, reconnect, reload, and confirm the PIN screen remains.
7. Confirm the installed/service-worker-controlled page reloads once after an update.
```

Stop the dev server when the smoke check ends. Leave the disposable local test ledger in place or remove that dedicated database through its normal local database-management workflow; never reset or drop a database from this plan. A real service-worker update check must use a production build on `localhost`; record that separate check in Task 8's release evidence if development mode does not register the worker.

- [ ] **Step 8: Commit the client split**

Run:

```bash
git add src/app/PointsPage.tsx src/app/points src/__tests__/app/usePointsController.test.tsx
git commit -m "refactor: separate points page responsibilities"
```

---

### Task 8: Add safe API errors, CI gates, dependency monitoring, and release verification

**Files:**
- Create: `src/lib/server/api-error.ts`
- Create: `src/__tests__/lib/api-error.test.ts`
- Modify: `src/app/api/points/route.ts`
- Modify: `src/app/api/auth/route.ts`
- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`
- Modify: `.husky/pre-push`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `docs/security-and-operations.md`

**Interfaces:**
- Consumes: route exceptions, npm scripts, disposable PostgreSQL service, documented Vercel configuration.
- Produces: `internalServerError(scope, error): NextResponse`, zero-warning CI, weekly npm update PRs, and an exact release/rollback checklist.

- [ ] **Step 1: Add a failing non-disclosure test for server errors**

Create `src/__tests__/lib/api-error.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { internalServerError } from "@/lib/server/api-error";

afterEach(() => vi.restoreAllMocks());

describe("internalServerError", () => {
  it("returns a request ID without logging the raw exception message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("postgres://secret"), { code: "P1001" });

    const response = internalServerError("points.get", error);
    const body = await response.json();
    const entry = String(log.mock.calls[0]?.[0]);

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ error: "服务器暂时无法处理请求" });
    expect(body.requestId).toEqual(expect.any(String));
    expect(entry).toContain("points.get");
    expect(entry).toContain("P1001");
    expect(entry).toContain(body.requestId);
    expect(entry).not.toContain("postgres://secret");
  });
});
```

Run:

```bash
npm run test:run -- src/__tests__/lib/api-error.test.ts
```

Expected: FAIL because the helper does not exist yet.

- [ ] **Step 2: Add a safe server-error helper**

Create `src/lib/server/api-error.ts`:

```ts
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

function safeErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Z0-9_-]{1,32}$/.test(code)
    ? code
    : undefined;
}

export function internalServerError(scope: string, error: unknown): NextResponse {
  const requestId = randomUUID();
  console.error(JSON.stringify({
    level: "error",
    scope,
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode: safeErrorCode(error),
  }));
  return NextResponse.json(
    { error: "服务器暂时无法处理请求", requestId },
    { status: 500 },
  );
}
```

Replace both raw `Error.message` 500 responses in the points route with `internalServerError("points.get", error)` and `internalServerError("points.post", error)`. Use the same helper for unexpected auth-route failures. Do not pass request bodies, PINs, cookies, or tokens into this helper.

Run:

```bash
npm run test:run -- src/__tests__/lib/api-error.test.ts
```

Expected: PASS; the response contains a correlation ID and the captured log omits the raw database URL.

- [ ] **Step 3: Make lint warnings and verification failures blocking**

Change scripts to:

```json
{
  "scripts": {
    "lint": "eslint --max-warnings=0",
    "typecheck": "tsc --noEmit --incremental false",
    "test:run": "vitest run",
    "db:test:migrate": "node scripts/run-with-test-database.mjs npx --no-install prisma migrate deploy",
    "test:integration": "node scripts/run-with-test-database.mjs vitest run --config vitest.integration.config.ts",
    "audit:prod": "npm audit --omit=dev --audit-level=high",
    "verify": "npm run lint && npm run typecheck && npm run test:run && npm run build"
  }
}
```

Update `.husky/pre-push` to:

```sh
npm run verify
```

- [ ] **Step 4: Add the PostgreSQL-backed CI workflow**

Create the workflow directory once:

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: gemsteps_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres -d gemsteps_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/gemsteps_test
      GEMSTEPS_TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/gemsteps_test
      GEMSTEPS_PIN: "123456"
      GEMSTEPS_SESSION_SECRET: ci-only-session-secret-32-characters-minimum
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run db:test:migrate
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:run
      - run: npm run test:integration
      - run: npm run audit:prod
      - run: npm run build
```

- [ ] **Step 5: Add weekly dependency monitoring**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      next-react:
        patterns:
          - next
          - eslint-config-next
          - react
          - react-dom
      prisma:
        patterns:
          - prisma
          - "@prisma/*"
      serwist:
        patterns:
          - serwist
          - "@serwist/*"
    ignore:
      - dependency-name: "@types/node"
        update-types:
          - version-update:semver-major
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

- [ ] **Step 6: Complete operations and deployment documentation**

Update README development instructions to use Node 24 and list all three application environment variables without values. Document `GEMSTEPS_TEST_DATABASE_URL` separately as test-only, localhost-only, and required to end in `_test`; never suggest copying Production `DATABASE_URL` into it. In `docs/security-and-operations.md`, record this deployment sequence:

```text
1. Add GEMSTEPS_SESSION_SECRET to Preview and Production as a sensitive value.
2. Create both IP-keyed and JA4-keyed auth WAF rules in Log mode; capture matching Preview evidence; publish both Rate Limit rules before Production receives the new auth code.
3. Back up the production database using the provider's supported snapshot mechanism.
4. Run the read-only historical invariant checks; stop if total points are negative or any task/reward group is invalid.
5. Run `npx prisma migrate deploy` against production once; accept the migration's short PointEntry write lock.
6. Verify PointBalance.totalNet equals SUM(PointEntry.points) before application deployment.
7. Deploy the application commit.
8. Verify auth success/failure/429 for both WAF dimensions, GET points, concurrent add/undo/redeem rejection, offline queue, sticky local lock, and one PWA reload.
9. Monitor structured errors by requestId, database constraint failures, and database connection errors for 30 minutes.
10. Roll back application code if needed; do not roll back the additive migration or trigger.
```

Document the rollback limitation explicitly: the old application remains data-safe because the trigger rejects invalid inserts, but it reports a trigger rejection as 500 rather than 409, so an affected old client may retain and retry that outbox event until the hardened application is rolled forward.

Include these read-only preflight and projection checks, with credentials supplied through the environment rather than pasted into command history:

```sql
SHOW default_transaction_isolation;

SELECT COALESCE(SUM("points"), 0) AS total
FROM "PointEntry";

SELECT "type", "itemId", "dateKey", SUM("points") AS item_total
FROM "PointEntry"
WHERE "type" IN ('task', 'reward')
GROUP BY "type", "itemId", "dateKey"
HAVING ("type" = 'task' AND SUM("points") < 0)
  OR ("type" = 'reward' AND SUM("points") > 0);

SELECT
  (SELECT "totalNet" FROM "PointBalance" WHERE "id" = 'singleton') AS projected,
  COALESCE((SELECT SUM("points") FROM "PointEntry"), 0) AS ledger;
```

Expected before migration: isolation is `read committed`, total is nonnegative, and the grouped invariant query returns zero rows. Any other result stops the deployment for data or database-configuration remediation.

- [ ] **Step 7: Run the complete local release gate**

With the disposable PostgreSQL database migrated, run:

```bash
npm ci
test -n "$GEMSTEPS_TEST_DATABASE_URL"
test -n "$GEMSTEPS_PIN"
test -n "$GEMSTEPS_SESSION_SECRET"
npm run db:test:migrate
npm run lint
npm run typecheck
npm run test:run
npm run test:integration
npm run audit:prod
npm run build
git status --short
```

Expected: lint has zero warnings; unit and integration tests all pass; production audit and build exit 0; only intended documentation/code changes are present.

- [ ] **Step 8: Review the final diff against the design success criteria**

Run:

```bash
git diff --check
rg -n 'pointEntry\.findMany|createHmac\("sha256", configuredPin\)|handlePreviousDate|handleNextDate|SKIP_WAITING|as PointsState' src
```

Expected: `git diff --check` is silent; the banned-pattern scan is silent. Verify the migration is additive and every new required environment variable is documented before committing.

- [ ] **Step 9: Commit CI and operational hardening**

Run:

```bash
git add src/lib/server/api-error.ts src/__tests__/lib/api-error.test.ts src/app/api/points/route.ts src/app/api/auth/route.ts .github .husky/pre-push package.json package-lock.json README.md docs/security-and-operations.md
git commit -m "ci: enforce GemSteps release gates"
```

- [ ] **Step 10: Stop before production changes and request deployment authorization**

Report the exact commit IDs, verification output, unresolved audit advisories, migration name, required environment variable, both WAF rules, and the expected short write lock. Do not run production migration, change Vercel settings, or deploy until the user explicitly authorizes those external changes.
