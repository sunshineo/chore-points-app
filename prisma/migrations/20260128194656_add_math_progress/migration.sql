-- CreateTable
CREATE TABLE "MathProgress" (
    "id" TEXT NOT NULL,
    "kidId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "additionPassedAt" TIMESTAMP(3),
    "subtractionPassedAt" TIMESTAMP(3),
    "pointAwarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MathProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MathProgress_kidId_idx" ON "MathProgress"("kidId");

-- CreateIndex
CREATE UNIQUE INDEX "MathProgress_kidId_date_key" ON "MathProgress"("kidId", "date");

-- AddForeignKey
ALTER TABLE "MathProgress" ADD CONSTRAINT "MathProgress_kidId_fkey" FOREIGN KEY ("kidId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
