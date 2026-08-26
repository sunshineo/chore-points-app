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
