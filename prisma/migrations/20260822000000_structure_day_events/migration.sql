-- Replace duplicated note markers with the event fields the day app actually uses.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PointEntry"
    WHERE "note" IS NULL
       OR split_part(split_part("note", '[day-event:', 2), ']', 1) = ''
       OR split_part(split_part("note", '[day-date:', 2), ']', 1) = ''
       OR (
         split_part(split_part("note", '[day-task:', 2), ']', 1) = ''
         AND split_part(split_part("note", '[day-reward:', 2), ']', 1) = ''
       )
  ) THEN
    RAISE EXCEPTION 'PointEntry contains an event that cannot be structured';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM "PointEntry"
  ) <> (
    SELECT COUNT(DISTINCT split_part(split_part("note", '[day-event:', 2), ']', 1))
    FROM "PointEntry"
  ) THEN
    RAISE EXCEPTION 'PointEntry event ids are not unique';
  END IF;
END $$;

ALTER TABLE "PointEntry"
  ADD COLUMN "type" TEXT,
  ADD COLUMN "itemId" TEXT,
  ADD COLUMN "dateKey" TEXT;

UPDATE "PointEntry"
SET
  "id" = split_part(split_part("note", '[day-event:', 2), ']', 1),
  "type" = CASE
    WHEN "note" LIKE '%[day-task:%' THEN 'task'
    ELSE 'reward'
  END,
  "itemId" = CASE
    WHEN "note" LIKE '%[day-task:%'
      THEN split_part(split_part("note", '[day-task:', 2), ']', 1)
    ELSE split_part(split_part("note", '[day-reward:', 2), ']', 1)
  END,
  "dateKey" = split_part(split_part("note", '[day-date:', 2), ']', 1);

ALTER TABLE "PointEntry"
  ALTER COLUMN "type" SET NOT NULL,
  ALTER COLUMN "itemId" SET NOT NULL,
  ALTER COLUMN "dateKey" SET NOT NULL,
  DROP COLUMN "note";

CREATE INDEX "PointEntry_dateKey_idx" ON "PointEntry"("dateKey");
