import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createBulkAuditLogs } from "@/lib/audit";

// GET meals for a date
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (date) {
    const meals = await prisma.mealEntry.findMany({
      where: { date: new Date(date) },
      include: { member: { select: { id: true, name: true } } },
    });
    return NextResponse.json(meals);
  }

  if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
    const meals = await prisma.mealEntry.findMany({
      where: { date: { gte: startDate, lte: endDate } },
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
  if (!session || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { date, entries } = body;
  // entries: [{ memberId, breakfast, lunch, dinner }]

  const auditLogs: {
    editedById: string;
    tableName: string;
    recordId: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    action: "CREATE" | "UPDATE" | "DELETE";
  }[] = [];

  for (const entry of entries) {
    const total = (entry.breakfast || 0) + (entry.lunch || 0) + (entry.dinner || 0);

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
      // Track changes for audit log
      if (existing.breakfast !== entry.breakfast) {
        auditLogs.push({
          editedById: session.user.id,
          tableName: "MealEntry",
          recordId: existing.id,
          fieldName: "breakfast",
          oldValue: String(existing.breakfast),
          newValue: String(entry.breakfast),
          action: "UPDATE",
        });
      }
      if (existing.lunch !== entry.lunch) {
        auditLogs.push({
          editedById: session.user.id,
          tableName: "MealEntry",
          recordId: existing.id,
          fieldName: "lunch",
          oldValue: String(existing.lunch),
          newValue: String(entry.lunch),
          action: "UPDATE",
        });
      }
      if (existing.dinner !== entry.dinner) {
        auditLogs.push({
          editedById: session.user.id,
          tableName: "MealEntry",
          recordId: existing.id,
          fieldName: "dinner",
          oldValue: String(existing.dinner),
          newValue: String(entry.dinner),
          action: "UPDATE",
        });
      }

      await prisma.mealEntry.update({
        where: { id: existing.id },
        data: {
          breakfast: entry.breakfast,
          lunch: entry.lunch,
          dinner: entry.dinner,
          total,
        },
      });
    } else {
      const created = await prisma.mealEntry.create({
        data: {
          date: new Date(date),
          memberId: entry.memberId,
          breakfast: entry.breakfast || 0,
          lunch: entry.lunch || 0,
          dinner: entry.dinner || 0,
          total,
        },
      });

      auditLogs.push({
        editedById: session.user.id,
        tableName: "MealEntry",
        recordId: created.id,
        fieldName: "all",
        oldValue: null,
        newValue: `B:${entry.breakfast} L:${entry.lunch} D:${entry.dinner}`,
        action: "CREATE",
      });
    }
  }

  if (auditLogs.length > 0) {
    await createBulkAuditLogs(auditLogs);
  }

  return NextResponse.json({ success: true });
}
