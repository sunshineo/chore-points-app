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

CREATE FUNCTION "lock_point_balance"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1
  FROM "PointBalance"
  WHERE "id" = 'singleton'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PointBalance singleton is missing'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE TRIGGER "PointEntry_lock_balance"
BEFORE INSERT ON "PointEntry"
FOR EACH ROW EXECUTE FUNCTION "lock_point_balance"();

CREATE FUNCTION "reject_point_entry_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'PointEntry rows are immutable'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE TRIGGER "PointEntry_reject_mutation"
BEFORE UPDATE OR DELETE ON "PointEntry"
FOR EACH ROW EXECUTE FUNCTION "reject_point_entry_mutation"();

CREATE FUNCTION "sync_point_balance"() RETURNS TRIGGER AS $$
DECLARE
  item_total INTEGER;
BEGIN
  UPDATE "PointBalance"
  SET "totalNet" = "totalNet" + NEW."points", "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 'singleton';

  -- The BEFORE INSERT trigger serializes old and new application writers.
  -- This VOLATILE trigger can now see NEW plus every earlier committed event.
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
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE TRIGGER "PointEntry_sync_balance"
AFTER INSERT ON "PointEntry"
FOR EACH ROW EXECUTE FUNCTION "sync_point_balance"();

COMMIT;
