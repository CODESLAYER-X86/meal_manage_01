import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Synchronization Start ---');
  
  try {
    // Check MealPlan columns
    const mpCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name::text FROM information_schema.columns WHERE table_name = 'MealPlan'`
    );
    const existingMpCols = new Set(mpCols.map(c => c.column_name));
    console.log(`Current MealPlan columns: ${Array.from(existingMpCols).join(', ')}`);

    const mealPlanAlters: Record<string, string> = {
      cancelledSnapshot: `ALTER TABLE "MealPlan" ADD COLUMN IF NOT EXISTS "cancelledSnapshot" TEXT NOT NULL DEFAULT '{}'`,
      wastage: `ALTER TABLE "MealPlan" ADD COLUMN IF NOT EXISTS "wastage" TEXT NOT NULL DEFAULT '{}'`,
      meals: `ALTER TABLE "MealPlan" ADD COLUMN IF NOT EXISTS "meals" TEXT NOT NULL DEFAULT '{}'`,
      cancelledMeals: `ALTER TABLE "MealPlan" ADD COLUMN IF NOT EXISTS "cancelledMeals" TEXT NOT NULL DEFAULT '[]'`,
      breakfast: `ALTER TABLE "MealPlan" ADD COLUMN IF NOT EXISTS "breakfast" TEXT`,
      lunch: `ALTER TABLE "MealPlan" ADD COLUMN IF NOT EXISTS "lunch" TEXT`,
      dinner: `ALTER TABLE "MealPlan" ADD COLUMN IF NOT EXISTS "dinner" TEXT`,
      updatedAt: `ALTER TABLE "MealPlan" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    };

    for (const [col, sql] of Object.entries(mealPlanAlters)) {
      if (!existingMpCols.has(col)) {
        console.log(`Adding MealPlan.${col}...`);
        await prisma.$executeRawUnsafe(sql);
      }
    }

    // Check MealEntry columns
    const meCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name::text FROM information_schema.columns WHERE table_name = 'MealEntry'`
    );
    const existingMeCols = new Set(meCols.map(c => c.column_name));
    const mealEntryAlters: Record<string, string> = {
      meals: `ALTER TABLE "MealEntry" ADD COLUMN IF NOT EXISTS "meals" TEXT NOT NULL DEFAULT '{}'`,
      total: `ALTER TABLE "MealEntry" ADD COLUMN IF NOT EXISTS "total" DOUBLE PRECISION NOT NULL DEFAULT 0`,
      breakfast: `ALTER TABLE "MealEntry" ADD COLUMN IF NOT EXISTS "breakfast" DOUBLE PRECISION NOT NULL DEFAULT 0`,
      lunch: `ALTER TABLE "MealEntry" ADD COLUMN IF NOT EXISTS "lunch" DOUBLE PRECISION NOT NULL DEFAULT 0`,
      dinner: `ALTER TABLE "MealEntry" ADD COLUMN IF NOT EXISTS "dinner" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    };
    for (const [col, sql] of Object.entries(mealEntryAlters)) {
      if (!existingMeCols.has(col)) {
        console.log(`Adding MealEntry.${col}...`);
        await prisma.$executeRawUnsafe(sql);
      }
    }

    // Check MealStatus columns
    const msCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name::text FROM information_schema.columns WHERE table_name = 'MealStatus'`
    );
    const existingMsCols = new Set(msCols.map(c => c.column_name));
    const mealStatusAlters: Record<string, string> = {
      changedBy: `ALTER TABLE "MealStatus" ADD COLUMN IF NOT EXISTS "changedBy" TEXT`,
      updatedAt: `ALTER TABLE "MealStatus" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    };
    for (const [col, sql] of Object.entries(mealStatusAlters)) {
      if (!existingMsCols.has(col)) {
        console.log(`Adding MealStatus.${col}...`);
        await prisma.$executeRawUnsafe(sql);
      }
    }

    // Fix indexes
    console.log('Verifying indexes...');
    try { await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MealEntry_date_memberId_key" ON "MealEntry"("date", "memberId")`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MealStatus_date_memberId_meal_key" ON "MealStatus"("date", "memberId", "meal")`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MealPlan_date_messId_key" ON "MealPlan"("date", "messId")`); } catch (e) {}

    console.log('✅ Synchronization Complete!');
  } catch (err) {
    console.error('❌ Error during synchronization:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
