-- CreateTable
CREATE TABLE "CalendarSettings" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "selectedCalendarId" TEXT,
    "selectedCalendarName" TEXT,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "connectedByUserId" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSettings_familyId_key" ON "CalendarSettings"("familyId");

-- AddForeignKey
ALTER TABLE "CalendarSettings" ADD CONSTRAINT "CalendarSettings_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
