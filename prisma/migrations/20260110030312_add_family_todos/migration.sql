-- CreateTable
CREATE TABLE "FamilyTodo" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyTodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyTodo_familyId_idx" ON "FamilyTodo"("familyId");

-- CreateIndex
CREATE INDEX "FamilyTodo_familyId_isCompleted_idx" ON "FamilyTodo"("familyId", "isCompleted");

-- AddForeignKey
ALTER TABLE "FamilyTodo" ADD CONSTRAINT "FamilyTodo_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyTodo" ADD CONSTRAINT "FamilyTodo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
