import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
  const { date, breakfast, lunch, dinner } = body;

  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const plan = await prisma.mealPlan.upsert({
    where: { date_messId: { date: new Date(date), messId } },
    update: { breakfast: breakfast || null, lunch: lunch || null, dinner: dinner || null },
    create: {
      date: new Date(date),
      messId,
      breakfast: breakfast || null,
      lunch: lunch || null,
      dinner: dinner || null,
    },
  });

  return NextResponse.json(plan);
}
