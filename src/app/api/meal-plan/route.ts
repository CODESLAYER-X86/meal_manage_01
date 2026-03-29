import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET meal plans for a month or specific date
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (date) {
    const plan = await prisma.mealPlan.findUnique({
      where: { date_messId: { date: new Date(date), messId } },
    });
    return NextResponse.json(plan);
  }

  if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
    const plans = await prisma.mealPlan.findMany({
      where: { messId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(plans);
  }

  return NextResponse.json({ error: "Provide date or month+year" }, { status: 400 });
}

// POST - save/update a meal plan (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { date, breakfast, lunch, dinner, meals: mealsInput, cancelledMeals, wastage } = body;

  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  // Build meals JSON from either new format or legacy format
  let mealsObj: Record<string, string> = {};
  if (mealsInput && typeof mealsInput === "object") {
    mealsObj = mealsInput;
  } else {
    if (breakfast) mealsObj.breakfast = breakfast;
    if (lunch) mealsObj.lunch = lunch;
    if (dinner) mealsObj.dinner = dinner;
  }

  // Get existing plan for audit + cancel diff
  const existing = await prisma.mealPlan.findUnique({
    where: { date_messId: { date: new Date(date), messId } },
  });

  // --- Determine which meals are newly cancelled vs. newly un-cancelled ---
  let oldCancelled: string[] = [];
  try { oldCancelled = JSON.parse(existing?.cancelledMeals || "[]"); } catch { /* ignore */ }
  const newCancelled: string[] = Array.isArray(cancelledMeals) ? cancelledMeals : oldCancelled;

  const newlyCancelled = newCancelled.filter((m) => !oldCancelled.includes(m));
  const newlyRestored = oldCancelled.filter((m) => !newCancelled.includes(m));

  // Load existing snapshot
  let snapshot: Record<string, Record<string, number>> = {};
  try { snapshot = JSON.parse(existing?.cancelledSnapshot || "{}"); } catch { /* ignore */ }

  // --- SNAPSHOT: Before zeroing newly-cancelled meals, save current values ---
  if (newlyCancelled.length > 0) {
    const entries = await prisma.mealEntry.findMany({
      where: { date: new Date(date), messId },
    });

    for (const cm of newlyCancelled) {
      if (!snapshot[cm]) snapshot[cm] = {};
      for (const entry of entries) {
        let entryMeals: Record<string, number> = {};
        try { entryMeals = JSON.parse(entry.meals || "{}"); } catch { /* ignore */ }
        const legacyVal = (entry as Record<string, unknown>)[cm];
        const val = entryMeals[cm] ?? (legacyVal !== undefined ? Number(legacyVal) : 0);
        if (val > 0) {
          snapshot[cm][entry.memberId] = val;
        }
      }
    }
  }

  // --- RESTORE: For un-cancelled meals, restore values from snapshot ---
  if (newlyRestored.length > 0) {
    for (const rm of newlyRestored) {
      const mealSnapshot = snapshot[rm];
      if (!mealSnapshot || Object.keys(mealSnapshot).length === 0) continue;

      for (const [memberId, originalVal] of Object.entries(mealSnapshot)) {
        const entry = await prisma.mealEntry.findUnique({
          where: { date_memberId: { date: new Date(date), memberId } },
        });
        if (!entry) continue;

        let entryMeals: Record<string, number> = {};
        try { entryMeals = JSON.parse(entry.meals || "{}"); } catch { /* ignore */ }

        entryMeals[rm] = originalVal;
        const b = entryMeals.breakfast ?? 0;
        const l = entryMeals.lunch ?? 0;
        const d = entryMeals.dinner ?? 0;
        const total = Object.values(entryMeals).reduce((sum, v) => sum + Number(v), 0);

        await prisma.mealEntry.update({
          where: { id: entry.id },
          data: {
            breakfast: b, lunch: l, dinner: d,
            meals: JSON.stringify(entryMeals),
            total,
          },
        });
      }

      // Clean up used snapshot key
      delete snapshot[rm];
    }

    // Also restore MealStatus for restored meals
    for (const rm of newlyRestored) {
      await prisma.mealStatus.updateMany({
        where: { date: new Date(date), messId, meal: rm, isOff: true },
        data: { isOff: false },
      });
    }
  }

  // Upsert the plan with updated snapshot
  const plan = await prisma.mealPlan.upsert({
    where: { date_messId: { date: new Date(date), messId } },
    update: {
      breakfast: mealsObj.breakfast || breakfast || null,
      lunch: mealsObj.lunch || lunch || null,
      dinner: mealsObj.dinner || dinner || null,
      meals: JSON.stringify(mealsObj),
      cancelledMeals: JSON.stringify(newCancelled),
      cancelledSnapshot: JSON.stringify(snapshot),
      ...(wastage && { wastage: JSON.stringify(wastage) }),
    },
    create: {
      date: new Date(date),
      messId,
      breakfast: mealsObj.breakfast || breakfast || null,
      lunch: mealsObj.lunch || lunch || null,
      dinner: mealsObj.dinner || dinner || null,
      meals: JSON.stringify(mealsObj),
      cancelledMeals: JSON.stringify(newCancelled),
      cancelledSnapshot: JSON.stringify(snapshot),
      wastage: wastage ? JSON.stringify(wastage) : "{}",
    },
  });

  // --- ZERO OUT: Wipe MealEntry records for newly-cancelled meals ---
  if (newlyCancelled.length > 0) {
    const entries = await prisma.mealEntry.findMany({
      where: { date: new Date(date), messId },
    });

    for (const entry of entries) {
      let entryMeals: Record<string, number> = {};
      try { entryMeals = JSON.parse(entry.meals || "{}"); } catch { /* ignore */ }

      let changed = false;
      for (const cm of newlyCancelled) {
        if (entryMeals[cm] > 0 || ((entry as Record<string, unknown>)[cm] !== undefined && Number((entry as Record<string, unknown>)[cm]) > 0)) {
          entryMeals[cm] = 0;
          changed = true;
        }
      }

      if (changed) {
        const b = entryMeals.breakfast ?? 0;
        const l = entryMeals.lunch ?? 0;
        const d = entryMeals.dinner ?? 0;
        const total = Object.values(entryMeals).reduce((sum, v) => sum + Number(v), 0);

        await prisma.mealEntry.update({
          where: { id: entry.id },
          data: {
            breakfast: b, lunch: l, dinner: d,
            meals: JSON.stringify(entryMeals),
            total,
          },
        });
      }
    }

    // Also set MealStatus to OFF for cancelled meals
    for (const cm of newlyCancelled) {
      const members = await prisma.user.findMany({
        where: { messId, isActive: true },
        select: { id: true },
      });
      for (const m of members) {
        await prisma.mealStatus.upsert({
          where: { date_meal_memberId: { date: new Date(date), meal: cm, memberId: m.id } },
          update: { isOff: true, changedBy: session.user.id },
          create: { date: new Date(date), meal: cm, memberId: m.id, messId, isOff: true, changedBy: session.user.id },
        });
      }
    }
  }

  // Audit log
  const oldSummary = existing ? Object.entries(JSON.parse(existing.meals || "{}")).map(([k, v]) => `${k}:${v || "-"}`).join(" ") || `B:${existing.breakfast || "-"} L:${existing.lunch || "-"} D:${existing.dinner || "-"}` : null;
  const newSummary = Object.entries(mealsObj).map(([k, v]) => `${k}:${v || "-"}`).join(" ");

  // Extra audit entries for cancel/restore actions
  if (newlyCancelled.length > 0) {
    await createAuditLog({
      editedById: session.user.id,
      messId,
      tableName: "MealPlan",
      recordId: plan.id,
      fieldName: `cancel (${date})`,
      oldValue: oldCancelled.join(", ") || "none",
      newValue: `cancelled: ${newlyCancelled.join(", ")}`,
      action: "CANCEL",
    });
  }
  if (newlyRestored.length > 0) {
    await createAuditLog({
      editedById: session.user.id,
      messId,
      tableName: "MealPlan",
      recordId: plan.id,
      fieldName: `restore (${date})`,
      oldValue: `cancelled: ${newlyRestored.join(", ")}`,
      newValue: "restored from snapshot",
      action: "RESTORE",
    });
  }

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "MealPlan",
    recordId: plan.id,
    fieldName: `plan (${date})`,
    oldValue: oldSummary,
    newValue: newSummary,
    action: existing ? "UPDATE" : "CREATE",
  });

  return NextResponse.json(plan);
}
