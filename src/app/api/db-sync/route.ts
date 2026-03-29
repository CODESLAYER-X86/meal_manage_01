import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  
  // SECURITY: Only allow platform admins or designated platform admin email (NOT officers)
  const allowedEmails = (process.env.PLATFORM_ADMIN_EMAIL || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  const userEmail = session?.user?.email?.toLowerCase() || "";
  const isAdmin = (session?.user as any)?.isAdmin;
  
  if (!session || (!isAdmin && !allowedEmails.includes(userEmail))) {
    return NextResponse.json({ error: "Unauthorized. Only Platform Admins can run db-sync." }, { status: 403 });
  }

  const results: string[] = [];

  try {
    // Check what columns exist in the Mess table — cast to TEXT to avoid Neon adapter issues
    const messColumns = await prisma.$queryRawUnsafe<{ col: string }[]>(
      `SELECT column_name::text as col FROM information_schema.columns WHERE table_name = 'Mess' ORDER BY ordinal_position`
    );
    results.push(`Mess columns: ${messColumns.map(c => c.col).join(", ")}`);

    // Check User table columns
    const userColumns = await prisma.$queryRawUnsafe<{ col: string }[]>(
      `SELECT column_name::text as col FROM information_schema.columns WHERE table_name = 'User' ORDER BY ordinal_position`
    );
    results.push(`User columns: ${userColumns.map(c => c.col).join(", ")}`);

    // Check all tables
    const tables = await prisma.$queryRawUnsafe<{ tbl: string }[]>(
      `SELECT tablename::text as tbl FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    results.push(`Tables: ${tables.map(t => t.tbl).join(", ")}`);

    // --- Fix missing Mess columns ---
    const existingMessCols = new Set(messColumns.map(c => c.col));
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

    for (const [col, sql] of Object.entries(alterStatements)) {
      if (!existingMessCols.has(col)) {
        try {
          await prisma.$executeRawUnsafe(sql);
          results.push(`✅ Added Mess.${col}`);
        } catch (e: unknown) {
          results.push(`❌ Mess.${col}: ${(e as Error).message}`);
        }
      }
    }

    // --- Fix missing MealPlan columns ---
    const mpCols = await prisma.$queryRawUnsafe<{ col: string }[]>(
      `SELECT column_name::text as col FROM information_schema.columns WHERE table_name = 'MealPlan' ORDER BY ordinal_position`
    );
    const existingMpCols = new Set(mpCols.map(c => c.col));
    if (!existingMpCols.has('cancelledSnapshot')) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "MealPlan" ADD COLUMN IF NOT EXISTS "cancelledSnapshot" TEXT NOT NULL DEFAULT '{}'`);
        results.push(`✅ Added MealPlan.cancelledSnapshot`);
      } catch (e: unknown) {
        results.push(`❌ MealPlan.cancelledSnapshot: ${(e as Error).message}`);
      }
    }

    // --- Fix missing User columns ---
    const existingUserCols = new Set(userColumns.map(c => c.col));
    const userAlters: Record<string, string> = {
      isAdmin: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false`,
      isOfficer: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isOfficer" BOOLEAN NOT NULL DEFAULT false`,
      isActive: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
      emailVerified: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false`,
      phone: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
      leaveDate: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "leaveDate" TIMESTAMP(3)`,
    };

    for (const [col, sql] of Object.entries(userAlters)) {
      if (!existingUserCols.has(col)) {
        try {
          await prisma.$executeRawUnsafe(sql);
          results.push(`✅ Added User.${col}`);
        } catch (e: unknown) {
          results.push(`❌ User.${col}: ${(e as Error).message}`);
        }
      }
    }

    // --- Create missing tables ---
    const existingTables = new Set(tables.map(t => t.tbl));
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
      AdminSetting: `CREATE TABLE IF NOT EXISTS "AdminSetting" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AdminSetting_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "AdminSetting_key_key" UNIQUE ("key")
      )`,
    };

    for (const [table, sql] of Object.entries(createStatements)) {
      if (!existingTables.has(table)) {
        try {
          await prisma.$executeRawUnsafe(sql);
          results.push(`✅ Created table: ${table}`);
        } catch (e: unknown) {
          results.push(`❌ Table ${table}: ${(e as Error).message}`);
        }
      }
    }

    // --- Enforce PLATFORM_ADMIN_EMAIL: strip isAdmin from unauthorized users ---
    if (allowedEmails.length > 0) {
      try {
        // Find users who have isAdmin=true but email NOT in env var
        const revokedAdmins = await prisma.user.updateMany({
          where: {
            isAdmin: true,
            email: { notIn: allowedEmails },
          },
          data: { isAdmin: false },
        });
        if (revokedAdmins.count > 0) {
          results.push(`⚠️ Revoked admin from ${revokedAdmins.count} user(s) not in PLATFORM_ADMIN_EMAIL`);
        }

        // Promote users in env var who aren't admin yet
        const promoted = await prisma.user.updateMany({
          where: {
            email: { in: allowedEmails },
            isAdmin: false,
          },
          data: { isAdmin: true },
        });
        if (promoted.count > 0) {
          results.push(`✅ Promoted ${promoted.count} user(s) from PLATFORM_ADMIN_EMAIL to admin`);
        }
      } catch (e: unknown) {
        results.push(`❌ Admin sync: ${(e as Error).message}`);
      }
    }

    // Summary
    const fixes = results.filter(r => r.startsWith("✅") || r.startsWith("⚠️")).length;
    const errors = results.filter(r => r.startsWith("❌")).length;
    results.push(`\n--- SUMMARY: ${fixes} fixes applied, ${errors} errors ---`);

    return NextResponse.json({ success: true, diagnostics: results });
  } catch (error: unknown) {
    return NextResponse.json({
      error: (error as Error).message,
      diagnostics: results,
    }, { status: 500 });
  }
}
