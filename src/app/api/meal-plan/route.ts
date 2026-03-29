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

  // Get existing plan for audit
  const existing = await prisma.mealPlan.findUnique({
    where: { date_messId: { date: new Date(date), messId } },
  });

  const plan = await prisma.mealPlan.upsert({
    where: { date_messId: { date: new Date(date), messId } },
    update: {
      breakfast: mealsObj.breakfast || breakfast || null,
      lunch: mealsObj.lunch || lunch || null,
      dinner: mealsObj.dinner || dinner || null,
      meals: JSON.stringify(mealsObj),
      ...(cancelledMeals && { cancelledMeals: JSON.stringify(cancelledMeals) }),
      ...(wastage && { wastage: JSON.stringify(wastage) }),
    },
    create: {
      date: new Date(date),
      messId,
      breakfast: mealsObj.breakfast || breakfast || null,
      lunch: mealsObj.lunch || lunch || null,
      dinner: mealsObj.dinner || dinner || null,
      meals: JSON.stringify(mealsObj),
      cancelledMeals: cancelledMeals ? JSON.stringify(cancelledMeals) : "[]",
      wastage: wastage ? JSON.stringify(wastage) : "{}",
    },
  });

  // Retro-correction: wipe out MealEntry records for canceled meals
  if (cancelledMeals && Array.isArray(cancelledMeals) && cancelledMeals.length > 0) {
    const entries = await prisma.mealEntry.findMany({
      where: { date: new Date(date), messId }
    });

    for (const entry of entries) {
      let entryMeals: Record<string, number> = {};
      try { entryMeals = JSON.parse(entry.meals || "{}"); } catch {}
      
      let changed = false;
      for (const cm of cancelledMeals) {
        if (entryMeals[cm] > 0 || (entry as any)[cm] > 0) {
          entryMeals[cm] = 0;
          changed = true;
        }
      }

      if (changed) {
        // Fallback backward compatibility for basic 3 columns
        const b = entryMeals.breakfast ?? 0;
        const l = entryMeals.lunch ?? 0;
        const d = entryMeals.dinner ?? 0;
        const total = Object.values(entryMeals).reduce((sum, v) => sum + Number(v), 0);

        await prisma.mealEntry.update({
          where: { id: entry.id },
          data: {
            breakfast: b, lunch: l, dinner: d,
            meals: JSON.stringify(entryMeals),
            total
          }
        });
      }
    }
  }

  // Audit log
  const oldSummary = existing ? Object.entries(JSON.parse(existing.meals || "{}")).map(([k, v]) => `${k}:${v || "-"}`).join(" ") || `B:${existing.breakfast || "-"} L:${existing.lunch || "-"} D:${existing.dinner || "-"}` : null;
  const newSummary = Object.entries(mealsObj).map(([k, v]) => `${k}:${v || "-"}`).join(" ");
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
