-- Keep only the two tables used by /day. CASCADE removes foreign keys from
-- User and PointEntry that referenced the retired tables.
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "VerificationToken" CASCADE;
DROP TABLE IF EXISTS "CalendarSettings" CASCADE;
DROP TABLE IF EXISTS "FamilyTodo" CASCADE;
DROP TABLE IF EXISTS "Photo" CASCADE;
DROP TABLE IF EXISTS "Badge" CASCADE;
DROP TABLE IF EXISTS "AchievementBadge" CASCADE;
DROP TABLE IF EXISTS "SightWordProgress" CASCADE;
DROP TABLE IF EXISTS "SightWord" CASCADE;
DROP TABLE IF EXISTS "MathAttempt" CASCADE;
DROP TABLE IF EXISTS "MathProgress" CASCADE;
DROP TABLE IF EXISTS "MathSettings" CASCADE;
DROP TABLE IF EXISTS "CustomMathQuestion" CASCADE;
DROP TABLE IF EXISTS "BadgeTemplate" CASCADE;
DROP TABLE IF EXISTS "PlannedDayMealDish" CASCADE;
DROP TABLE IF EXISTS "PlannedDayMeal" CASCADE;
DROP TABLE IF EXISTS "PlannedDay" CASCADE;
DROP TABLE IF EXISTS "MealPlan" CASCADE;
DROP TABLE IF EXISTS "DailyMealDish" CASCADE;
DROP TABLE IF EXISTS "DailyMeal" CASCADE;
DROP TABLE IF EXISTS "DailyItem" CASCADE;
DROP TABLE IF EXISTS "DailyMealLog" CASCADE;
DROP TABLE IF EXISTS "PlannedMeal" CASCADE;
DROP TABLE IF EXISTS "WeeklyPlan" CASCADE;
DROP TABLE IF EXISTS "WeeklyVote" CASCADE;
DROP TABLE IF EXISTS "MealLog" CASCADE;
DROP TABLE IF EXISTS "Dish" CASCADE;
DROP TABLE IF EXISTS "Redemption" CASCADE;
DROP TABLE IF EXISTS "Reward" CASCADE;
DROP TABLE IF EXISTS "Chore" CASCADE;
DROP TABLE IF EXISTS "Family" CASCADE;

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "emailVerified",
  DROP COLUMN IF EXISTS "image",
  DROP COLUMN IF EXISTS "password",
  DROP COLUMN IF EXISTS "lastViewedPoints",
  DROP COLUMN IF EXISTS "familyId";

ALTER TABLE "PointEntry"
  DROP COLUMN IF EXISTS "familyId",
  DROP COLUMN IF EXISTS "choreId",
  DROP COLUMN IF EXISTS "photoUrl",
  DROP COLUMN IF EXISTS "redemptionId",
  DROP COLUMN IF EXISTS "createdById",
  DROP COLUMN IF EXISTS "updatedById",
  DROP COLUMN IF EXISTS "updatedAt";

-- Only marker-based /day entries remain relevant. Normalize every surviving
-- row to the sole child before deleting the retired parent/login users.
DELETE FROM "PointEntry"
WHERE "note" IS NULL
   OR (
     "note" NOT LIKE '%[day-task:%'
     AND "note" NOT LIKE '%[day-reward:%'
     AND "note" NOT LIKE '%[day-date:%'
   );

DO $$
DECLARE
  only_kid_id TEXT;
BEGIN
  SELECT "id" INTO only_kid_id
  FROM "User"
  WHERE "role" = 'KID'
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF only_kid_id IS NULL THEN
    RAISE EXCEPTION 'day-only migration requires one KID user';
  END IF;

  UPDATE "PointEntry"
  SET "kidId" = only_kid_id;

  DELETE FROM "User" WHERE "id" <> only_kid_id;
END $$;

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "role",
  DROP COLUMN IF EXISTS "createdAt",
  DROP COLUMN IF EXISTS "updatedAt";

DROP TYPE IF EXISTS "RedemptionStatus";
DROP TYPE IF EXISTS "MealType";
DROP TYPE IF EXISTS "PhotoProvider";
DROP TYPE IF EXISTS "Role";
