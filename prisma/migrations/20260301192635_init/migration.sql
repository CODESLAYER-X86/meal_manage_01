-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "CleaningStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaveDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "memberId" TEXT NOT NULL,
    "breakfast" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lunch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dinner" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BazarTrip" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "buyerId" TEXT NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BazarTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BazarItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BazarItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WashroomCleaning" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "CleaningStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WashroomCleaning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerRotation" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerRotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "MealEntry_date_idx" ON "MealEntry"("date");

-- CreateIndex
CREATE INDEX "MealEntry_memberId_idx" ON "MealEntry"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MealEntry_date_memberId_key" ON "MealEntry"("date", "memberId");

-- CreateIndex
CREATE INDEX "Deposit_date_idx" ON "Deposit"("date");

-- CreateIndex
CREATE INDEX "Deposit_memberId_idx" ON "Deposit"("memberId");

-- CreateIndex
CREATE INDEX "BazarTrip_date_idx" ON "BazarTrip"("date");

-- CreateIndex
CREATE INDEX "WashroomCleaning_date_idx" ON "WashroomCleaning"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WashroomCleaning_date_memberId_key" ON "WashroomCleaning"("date", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerRotation_month_year_key" ON "ManagerRotation"("month", "year");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tableName_idx" ON "AuditLog"("tableName");

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazarTrip" ADD CONSTRAINT "BazarTrip_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazarItem" ADD CONSTRAINT "BazarItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "BazarTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashroomCleaning" ADD CONSTRAINT "WashroomCleaning_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerRotation" ADD CONSTRAINT "ManagerRotation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
