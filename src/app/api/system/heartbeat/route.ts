import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Helper: get Bangladesh time components
function getBDTime() {
  const now = new Date();
  const bd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return { hour: bd.getUTCHours(), minute: bd.getUTCMinutes(), now, bd };
}

// Helper: check if blackout has STARTED
function hasBlackoutStarted(meal: string, blackouts: any[]): boolean {
  const { hour, minute } = getBDTime();
  const nowTotal = hour * 60 + minute;
  for (const b of blackouts) {
    if (!b.meals?.includes(meal)) continue;
    const startTotal = b.startHour * 60 + (b.startMinute ?? 0);
    if (nowTotal >= startTotal) return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Secure the endpoint (you can use Vercel cron secrets or a custom token)
    const authHeader = request.headers.get("authorization");
    if (
      authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      process.env.NODE_ENV === "production"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch all messes with auto-meal entry enabled
    const messes = await prisma.mess.findMany({
      where: { autoMealEntry: true },
      select: { id: true, mealTypes: true, mealsPerDay: true, mealBlackouts: true },
    });

    const { bd } = getBDTime();
    const todayStr = `${bd.getUTCFullYear()}-${String(bd.getUTCMonth() + 1).padStart(2, '0')}-${String(bd.getUTCDate()).padStart(2, '0')}`;
    const todayDate = new Date(todayStr + "T00:00:00.000Z");

    let processedCount = 0;

    for (const mess of messes) {
      let blackouts: any[] = [];
      try {
        const parsed = mess.mealBlackouts ? JSON.parse(mess.mealBlackouts) : [];
        if (Array.isArray(parsed)) blackouts = parsed;
      } catch { /* ignore */ }

      // Get dynamic meal list
      let mealsList: string[] = [];
      if (mess.mealTypes) {
        try {
          const parsed = JSON.parse(mess.mealTypes);
          if (Array.isArray(parsed) && parsed.length > 0) mealsList = parsed;
        } catch { /* fallback */ }
      }
      if (mealsList.length === 0) {
        mealsList = mess.mealsPerDay === 2 ? ["lunch", "dinner"] : ["breakfast", "lunch", "dinner"];
      }

      const lockedMeals = mealsList.filter((meal: string) => hasBlackoutStarted(meal, blackouts));
      if (lockedMeals.length === 0) continue;

      const members = await prisma.user.findMany({
        where: { messId: mess.id, isActive: true },
        select: { id: true },
      });

      for (const m of members) {
        const existingEntry = await prisma.mealEntry.findFirst({
          where: { date: todayDate, memberId: m.id },
        });

        let existingMealsObj: Record<string, number> = {};
        if (existingEntry?.meals) {
          try { existingMealsObj = JSON.parse(existingEntry.meals as string); } catch { /* ignore */ }
        }

        const mealsNeedingSnapshot = lockedMeals.filter((meal: string) => !(meal in existingMealsObj));
        if (mealsNeedingSnapshot.length === 0) continue; 

        // Read current MealStatus for just the meals that need snapshotting
        const mealStatuses = await prisma.mealStatus.findMany({
          where: { memberId: m.id, messId: mess.id, date: todayDate, meal: { in: mealsNeedingSnapshot } },
          select: { meal: true, isOff: true },
        });

        const sMap: Record<string, boolean> = {};
        for (const s of mealStatuses) sMap[s.meal] = s.isOff;

        // Write snapshot values
        for (const meal of mealsNeedingSnapshot) {
          existingMealsObj[meal] = sMap[meal] ? 0 : 1;
        }

        let total = 0;
        for (const meal of mealsList) total += existingMealsObj[meal] ?? 0;
        const breakfast = existingMealsObj["breakfast"] ?? 0;
        const lunch = existingMealsObj["lunch"] ?? 0;
        const dinner = existingMealsObj["dinner"] ?? 0;

        if (existingEntry) {
          await prisma.mealEntry.update({
            where: { id: existingEntry.id },
            data: { breakfast, lunch, dinner, meals: JSON.stringify(existingMealsObj), total },
          });
        } else {
          await prisma.mealEntry.create({
            data: { date: todayDate, memberId: m.id, messId: mess.id, breakfast, lunch, dinner, meals: JSON.stringify(existingMealsObj), total },
          });
        }
        processedCount++;
      }
    }

    return NextResponse.json({ success: true, processedCount, message: "Heartbeat execution successful" });

  } catch (err: any) {
    console.error("Heartbeat error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
