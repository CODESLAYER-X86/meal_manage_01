import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// This endpoint checks the database schema and adds any missing columns
// Call GET /api/db-sync to diagnose and fix schema issues
export async function GET() {
  const results: string[] = [];

  try {
    // Check what columns actually exist in the Mess table
    const messColumns = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'Mess' ORDER BY ordinal_position`
    );
    results.push(`Mess columns: ${messColumns.map(c => c.column_name).join(", ")}`);

    // Check User table columns
    const userColumns = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'User' ORDER BY ordinal_position`
    );
    results.push(`User columns: ${userColumns.map(c => c.column_name).join(", ")}`);

    // Check all tables
    const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    results.push(`Tables: ${tables.map(t => t.tablename).join(", ")}`);

    // Expected Mess columns from schema
    const expectedMessColumns = [
      "id", "name", "inviteCode", "washroomCount", "dueThreshold",
      "bazarDaysPerWeek", "hasGas", "hasCook", "autoMealEntry",
      "mealsPerDay", "mealTypes", "mealBlackouts",
      "createdById", "createdAt", "updatedAt"
    ];

    const existingMessCols = new Set(messColumns.map(c => c.column_name));
    const missingMessCols = expectedMessColumns.filter(c => !existingMessCols.has(c));
    results.push(`Missing Mess columns: ${missingMessCols.length > 0 ? missingMessCols.join(", ") : "NONE"}`);

    // Auto-fix missing columns
    if (missingMessCols.length > 0) {
      const alterStatements: Record<string, string> = {
        washroomCount: `ALTER TABLE "Mess" ADD COLUMN IF NOT EXISTS "washroomCount" INTEGER NOT NULL DEFAULT 0`,
        dueThreshold: `ALTER TABLE "Mess" ADD COLUMN IF NOT EXISTS "dueThreshold" DOUBLE PRECISION NOT NULL DEFAULT 500`,
        bazarDaysPerWeek: `ALTER TABLE "Mess" ADD COLUMN IF NOT EXISTS "bazarDaysPerWeek" INTEGER NOT NULL DEFAULT 3`,
        hasGas: `ALTER TABLE "Mess" ADD COLUMN IF NOT EXISTS "hasGas" BOOLEAN NOT NULL DEFAULT false`,
        hasCook: `ALTER TABLE "Mess" ADD COLUMN IF NOT EXISTS "hasCook" BOOLEAN NOT NULL DEFAULT false`,
        autoMealEntry: `ALTER TABLE "Mess" ADD COLUMN IF NOT EXISTS "autoMealEntry" BOOLEAN NOT NULL DEFAULT false`,
        mealsPerDay: `ALTER TABLE "Mess" ADD COLUMN IF NOT EXISTS "mealsPerDay" INTEGER NOT NULL DEFAULT 3`,
        mealTypes: `ALTER TABLE "Mess" ADD COLUMN IF NOT EXISTS "mealTypes" TEXT NOT NULL DEFAULT '["breakfast","lunch","dinner"]'`,
        mealBlackouts: `ALTER TABLE "Mess" ADD COLUMN IF NOT EXISTS "mealBlackouts" TEXT NOT NULL DEFAULT '[]'`,
      };

      for (const col of missingMessCols) {
        if (alterStatements[col]) {
          try {
            await prisma.$executeRawUnsafe(alterStatements[col]);
            results.push(`✅ Added missing column: Mess.${col}`);
          } catch (e: unknown) {
            results.push(`❌ Failed to add Mess.${col}: ${(e as Error).message}`);
          }
        }
      }
    }

    // Check for missing tables and create them
    const existingTables = new Set(tables.map(t => t.tablename));
    const expectedTables = [
      "Mess", "User", "MealEntry", "Deposit", "BazarTrip", "BazarItem",
      "WashroomCleaning", "ManagerRotation", "AuditLog", "Dispute",
      "JoinRequest", "MealPlan", "MealOffRequest", "Announcement",
      "Notification", "MealRating", "MealVoteTopic", "MealVote",
      "BillSetting", "BillPayment", "MemberPresence", "MealStatus",
      "MealStatusRequest", "AdminSetting", "Fine", "BazarDutySchedule",
      "WashroomDutySchedule", "DutySwapRequest", "VerificationToken"
    ];
    const missingTables = expectedTables.filter(t => !existingTables.has(t));
    results.push(`Missing tables: ${missingTables.length > 0 ? missingTables.join(", ") : "NONE"}`);

    // Create missing tables with basic structure
    const createStatements: Record<string, string> = {
      DutySwapRequest: `CREATE TABLE IF NOT EXISTS "DutySwapRequest" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "dutyType" TEXT NOT NULL,
        "fromDutyId" TEXT NOT NULL,
        "toDutyId" TEXT NOT NULL,
        "requesterId" TEXT NOT NULL,
        "messId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DutySwapRequest_pkey" PRIMARY KEY ("id")
      )`,
      BazarDutySchedule: `CREATE TABLE IF NOT EXISTS "BazarDutySchedule" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "date" TIMESTAMP(3) NOT NULL,
        "memberId" TEXT NOT NULL,
        "messId" TEXT NOT NULL,
        "completed" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BazarDutySchedule_pkey" PRIMARY KEY ("id")
      )`,
      WashroomDutySchedule: `CREATE TABLE IF NOT EXISTS "WashroomDutySchedule" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "date" TIMESTAMP(3) NOT NULL,
        "memberId" TEXT NOT NULL,
        "messId" TEXT NOT NULL,
        "washroomNumber" INTEGER NOT NULL DEFAULT 1,
        "completed" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "WashroomDutySchedule_pkey" PRIMARY KEY ("id")
      )`,
      Fine: `CREATE TABLE IF NOT EXISTS "Fine" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "memberId" TEXT NOT NULL,
        "messId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "reason" TEXT NOT NULL,
        "settled" BOOLEAN NOT NULL DEFAULT false,
        "settledAt" TIMESTAMP(3),
        "createdById" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Fine_pkey" PRIMARY KEY ("id")
      )`,
      MealStatusRequest: `CREATE TABLE IF NOT EXISTS "MealStatusRequest" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "date" TIMESTAMP(3) NOT NULL,
        "meal" TEXT NOT NULL,
        "memberId" TEXT NOT NULL,
        "messId" TEXT NOT NULL,
        "wantOff" BOOLEAN NOT NULL,
        "reason" TEXT,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MealStatusRequest_pkey" PRIMARY KEY ("id")
      )`,
      MealStatus: `CREATE TABLE IF NOT EXISTS "MealStatus" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "date" TIMESTAMP(3) NOT NULL,
        "meal" TEXT NOT NULL,
        "memberId" TEXT NOT NULL,
        "messId" TEXT NOT NULL,
        "isOff" BOOLEAN NOT NULL DEFAULT false,
        "changedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MealStatus_pkey" PRIMARY KEY ("id")
      )`,
      MemberPresence: `CREATE TABLE IF NOT EXISTS "MemberPresence" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "memberId" TEXT NOT NULL,
        "messId" TEXT NOT NULL,
        "isAway" BOOLEAN NOT NULL DEFAULT false,
        "awayFrom" TIMESTAMP(3),
        "awayUntil" TIMESTAMP(3),
        "reason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MemberPresence_pkey" PRIMARY KEY ("id")
      )`,
      BillSetting: `CREATE TABLE IF NOT EXISTS "BillSetting" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "messId" TEXT NOT NULL,
        "month" INTEGER NOT NULL,
        "year" INTEGER NOT NULL,
        "rents" TEXT NOT NULL DEFAULT '{}',
        "wifi" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "electricity" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "gas" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "cookSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "other" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "otherNote" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BillSetting_pkey" PRIMARY KEY ("id")
      )`,
      BillPayment: `CREATE TABLE IF NOT EXISTS "BillPayment" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "memberId" TEXT NOT NULL,
        "messId" TEXT NOT NULL,
        "month" INTEGER NOT NULL,
        "year" INTEGER NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "note" TEXT,
        "confirmed" BOOLEAN NOT NULL DEFAULT false,
        "confirmedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BillPayment_pkey" PRIMARY KEY ("id")
      )`,
    };

    for (const table of missingTables) {
      if (createStatements[table]) {
        try {
          await prisma.$executeRawUnsafe(createStatements[table]);
          results.push(`✅ Created missing table: ${table}`);
        } catch (e: unknown) {
          results.push(`❌ Failed to create ${table}: ${(e as Error).message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      diagnostics: results,
    });
  } catch (error: unknown) {
    return NextResponse.json({
      error: (error as Error).message,
      diagnostics: results,
    }, { status: 500 });
  }
}
