import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createBulkAuditLogs } from "@/lib/audit";

// GET meals for a date
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
    const meals = await prisma.mealEntry.findMany({
      where: { date: new Date(date), messId },
      include: { member: { select: { id: true, name: true } } },
    });
    return NextResponse.json(meals);
  }

  if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
    const meals = await prisma.mealEntry.findMany({
      where: { date: { gte: startDate, lte: endDate }, messId },
      include: { member: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(meals);
  }

  return NextResponse.json({ error: "Provide date or month+year" }, { status: 400 });
}

// POST - save meals for a date (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  // Get mess config for dynamic meal types
  const mess = await prisma.mess.findUnique({
    where: { id: messId },
    select: { mealTypes: true, mealsPerDay: true },
  });
  let mealTypesList: string[];
  try {
    mealTypesList = JSON.parse(mess?.mealTypes ?? '["breakfast","lunch","dinner"]');
  } catch {
    mealTypesList = ["breakfast", "lunch", "dinner"];
  }

  const body = await request.json();
  const { date, entries } = body;
  // entries: [{ memberId, meals: { breakfast: 1, lunch: 0, ... } }]
  // OR legacy: [{ memberId, breakfast, lunch, dinner }]

  const auditLogs: {
    editedById: string;
    messId: string;
    tableName: string;
    recordId: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    action: "CREATE" | "UPDATE" | "DELETE";
  }[] = [];

  // Fetch all member names in one query for audit log readability
  const memberIds = entries.map((e: { memberId: string }) => e.memberId);
  const members = await prisma.user.findMany({
    where: { id: { in: memberIds }, messId },
    select: { id: true, name: true },
  });
  const memberNameMap = Object.fromEntries(members.map((m) => [m.id, m.name]));

  for (const entry of entries) {
    // Build meals object from entry — support both formats
    const mealsObj: Record<string, number> = {};
    if (entry.meals && typeof entry.meals === "object") {
      for (const mt of mealTypesList) {
        mealsObj[mt] = Number(entry.meals[mt]) || 0;
      }
    } else {
      // Legacy format
      for (const mt of mealTypesList) {
        mealsObj[mt] = Number(entry[mt]) || 0;
      }
    }

    const total = Object.values(mealsObj).reduce((sum, v) => sum + v, 0);
    const memberName = memberNameMap[entry.memberId] || "Unknown";

    // Legacy columns (keep backward compat)
    const breakfast = mealsObj["breakfast"] ?? 0;
    const lunch = mealsObj["lunch"] ?? 0;
    const dinner = mealsObj["dinner"] ?? 0;

    // Check existing entry
    const existing = await prisma.mealEntry.findUnique({
      where: {
        date_memberId: {
          date: new Date(date),
          memberId: entry.memberId,
        },
      },
    });

    if (existing) {
      // Parse existing meals JSON for comparison
      let existingMeals: Record<string, number> = {};
      try { existingMeals = JSON.parse(existing.meals || "{}"); } catch { /* */ }

      // Track changes for audit log
      for (const mt of mealTypesList) {
        const oldVal = existingMeals[mt] ?? (existing as Record<string, unknown>)[mt] ?? 0;
        const newVal = mealsObj[mt] ?? 0;
        if (Number(oldVal) !== Number(newVal)) {
          auditLogs.push({
            editedById: session.user.id,
            messId,
            tableName: "MealEntry",
            recordId: existing.id,
            fieldName: `${memberName} - ${mt}`,
            oldValue: String(oldVal),
            newValue: String(newVal),
            action: "UPDATE",
          });
        }
      }

      await prisma.mealEntry.update({
        where: { id: existing.id },
        data: {
          breakfast, lunch, dinner,
          meals: JSON.stringify(mealsObj),
          total,
        },
      });
    } else {
      const created = await prisma.mealEntry.create({
        data: {
          date: new Date(date),
          memberId: entry.memberId,
          messId,
          breakfast, lunch, dinner,
          meals: JSON.stringify(mealsObj),
          total,
        },
      });

      const summary = mealTypesList.map(mt => `${mt.charAt(0).toUpperCase()}:${mealsObj[mt]}`).join(" ");
      auditLogs.push({
        editedById: session.user.id,
        messId,
        tableName: "MealEntry",
        recordId: created.id,
        fieldName: `${memberName} - all`,
        oldValue: null,
        newValue: summary,
        action: "CREATE",
      });
    }
  }

  if (auditLogs.length > 0) {
    await createBulkAuditLogs(auditLogs);
  }

  return NextResponse.json({ success: true });
}
