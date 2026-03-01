import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET washroom cleaning schedule
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
    const duties = await prisma.washroomCleaning.findMany({
      where: { date: { gte: startDate, lte: endDate }, messId },
      include: { member: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(duties);
  }

  // Next 7 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const duties = await prisma.washroomCleaning.findMany({
    where: { date: { gte: today, lte: nextWeek }, messId },
    include: { member: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(duties);
}

// POST - assign washroom duties (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { assignments } = body;
  // assignments: [{ date, memberId }]

  const results = [];
  for (const assignment of assignments) {
    const duty = await prisma.washroomCleaning.upsert({
      where: {
        date_memberId: {
          date: new Date(assignment.date),
          memberId: assignment.memberId,
        },
      },
      update: { memberId: assignment.memberId },
      create: {
        date: new Date(assignment.date),
        memberId: assignment.memberId,
        messId,
      },
    });
    results.push(duty);
  }

  return NextResponse.json(results);
}

// PATCH - mark duty as done (member can mark own)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, status } = body;

  const duty = await prisma.washroomCleaning.findUnique({ where: { id } });
  if (!duty) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Members can only mark their own duties
  if (session.user.role !== "MANAGER" && duty.memberId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const updated = await prisma.washroomCleaning.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(updated);
}
