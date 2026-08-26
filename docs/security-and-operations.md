# Security and operations

## Session configuration

Production requires a six-digit `GEMSTEPS_PIN` and a separately generated
`GEMSTEPS_SESSION_SECRET`. Generate the secret from at least 32 random bytes and
store it as a sensitive environment variable. Runtime byte-length validation is
only a minimum guard; it cannot measure the secret's entropy.

```sh
openssl rand -base64 32
```

This command prints the generated secret to standard output. Do not commit,
record, or share that output; store it directly through an approved sensitive
environment-value workflow.

The session token signs its version and absolute expiration with the session
secret. The configured PIN is included in the signed message, but is never used
as the HMAC key. Rotating either the PIN or the secret invalidates every
outstanding token.

Local lock and `DELETE /api/auth` do not revoke a copied token. Unless the PIN or
secret is rotated, a copied token remains valid until its embedded expiration.

## Mandatory production WAF rules

Both rules below are mandatory before exposing the authentication code in
Production.

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

First observe matching Preview traffic in Log mode and capture evidence. Then
publish both rules in Rate Limit mode before the production deployment. These
steps require explicit authorization for external changes; this repository task
documents them but does not publish rules, deploy, or otherwise modify Vercel.

## Production deployment sequence

Database and application credentials must be supplied through the environment;
never paste credential values into shell history.

1. Add `GEMSTEPS_SESSION_SECRET` to Preview and Production as a sensitive value.
2. Create both IP-keyed and JA4-keyed auth WAF rules in Log mode; capture
   matching Preview evidence; publish both Rate Limit rules before Production
   receives the new auth code.
3. Back up the production database using the provider's supported snapshot
   mechanism.
4. Run the read-only historical invariant checks below; stop if total points are
   negative or any task/reward group is invalid.
5. Run `npx prisma migrate deploy` against production once; accept the
   migration's short `PointEntry` write lock.
6. Verify `PointBalance.totalNet` equals `SUM(PointEntry.points)` before
   application deployment.
7. Deploy the application commit.
8. Verify auth success, failure, and 429 behavior for both WAF dimensions; GET
   points; concurrent add/undo/redeem rejection; the offline queue; sticky local
   lock; and one PWA reload.
9. Monitor structured errors by `requestId`, database constraint failures, and
   database connection errors for 30 minutes.
10. Roll back application code if needed; do not roll back the additive migration
    or trigger.

Before migration, confirm the database uses `read committed` isolation:

```sql
SHOW default_transaction_isolation;
```

Then confirm the total is nonnegative and no task/reward group violates its
historical invariant:

```sql
SELECT COALESCE(SUM("points"), 0) AS total
FROM "PointEntry";

SELECT "type", "itemId", "dateKey", SUM("points") AS item_total
FROM "PointEntry"
WHERE "type" IN ('task', 'reward')
GROUP BY "type", "itemId", "dateKey"
HAVING ("type" = 'task' AND SUM("points") < 0)
  OR ("type" = 'reward' AND SUM("points") > 0);
```

Expected before migration: isolation is `read committed`, total is nonnegative,
and the grouped invariant query returns zero rows. Any other result stops the
deployment for data or database-configuration remediation.

After migration and before application deployment, verify the projection:

```sql
SELECT
  (SELECT "totalNet" FROM "PointBalance" WHERE "id" = 'singleton') AS projected,
  COALESCE((SELECT SUM("points") FROM "PointEntry"), 0) AS ledger;
```

The projected and ledger values must be equal. A mismatch stops deployment for
remediation.

## Rollback limitation

The old application remains data-safe because the trigger rejects invalid
inserts, but it reports a trigger rejection as 500 rather than 409. An affected
old client may therefore retain and retry that outbox event until the hardened
application is rolled forward. Roll back application code only; do not roll back
the additive migration or trigger.
