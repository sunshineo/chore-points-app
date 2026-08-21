-- The application has one global point ledger, so child identity is no longer stored.
ALTER TABLE "PointEntry" DROP COLUMN IF EXISTS "kidId";
DROP TABLE IF EXISTS "User" CASCADE;
