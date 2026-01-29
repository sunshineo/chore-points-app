-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealLog" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "loggedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyVote" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "dishId" TEXT,
    "suggestedDishName" TEXT,
    "voterId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dish_familyId_idx" ON "Dish"("familyId");

-- CreateIndex
CREATE INDEX "Dish_familyId_totalVotes_idx" ON "Dish"("familyId", "totalVotes");

-- CreateIndex
CREATE INDEX "MealLog_familyId_idx" ON "MealLog"("familyId");

-- CreateIndex
CREATE INDEX "MealLog_familyId_date_idx" ON "MealLog"("familyId", "date");

-- CreateIndex
CREATE INDEX "MealLog_dishId_idx" ON "MealLog"("dishId");

-- CreateIndex
CREATE INDEX "WeeklyVote_familyId_idx" ON "WeeklyVote"("familyId");

-- CreateIndex
CREATE INDEX "WeeklyVote_familyId_weekStart_idx" ON "WeeklyVote"("familyId", "weekStart");

-- CreateIndex
CREATE INDEX "WeeklyVote_voterId_idx" ON "WeeklyVote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyVote_familyId_voterId_dishId_weekStart_key" ON "WeeklyVote"("familyId", "voterId", "dishId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyVote_familyId_voterId_suggestedDishName_weekStart_key" ON "WeeklyVote"("familyId", "voterId", "suggestedDishName", "weekStart");

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyVote" ADD CONSTRAINT "WeeklyVote_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyVote" ADD CONSTRAINT "WeeklyVote_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyVote" ADD CONSTRAINT "WeeklyVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
