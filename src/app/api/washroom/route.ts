import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET washroom cleaning schedule for a month
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  // Check if washroom cleaning is enabled for this mess
  const mess = await prisma.mess.findUnique({
    where: { id: messId },
    select: { washroomCount: true },
  });

  if (!mess || mess.washroomCount === 0) {
    return NextResponse.json({ error: "Washroom cleaning is not enabled for this mess", disabled: true }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const duties = await prisma.washroomCleaning.findMany({
    where: { date: { gte: startDate, lte: endDate }, messId },
    include: { member: { select: { id: true, name: true } } },
    orderBy: [{ date: "asc" }, { washroomNumber: "asc" }],
  });

  // Get members for this mess
  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ duties, members, washroomCount: mess.washroomCount });
}

// POST - Generate washroom rotation for a month (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  // Get mess washroom config
  const mess = await prisma.mess.findUnique({
    where: { id: messId },
    select: { washroomCount: true },
  });

  if (!mess || mess.washroomCount === 0) {
    return NextResponse.json({ error: "Washroom cleaning is not enabled for this mess" }, { status: 400 });
  }

  const body = await request.json();
  const { month, year } = body;

  if (!month || !year) {
    return NextResponse.json({ error: "Month and year are required" }, { status: 400 });
  }

  // Get active members
  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (members.length === 0) {
    return NextResponse.json({ error: "No active members in this mess" }, { status: 400 });
  }

  // Check if schedule already exists for this month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const existing = await prisma.washroomCleaning.findFirst({
    where: { date: { gte: startDate, lte: endDate }, messId },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Schedule already exists for this month. Delete it first to regenerate." },
      { status: 400 }
    );
  }

  // Generate rotation: clean every 14 days
  // Each cleaning day has `washroomCount` assignments (one member per washroom)
  const INTERVAL_DAYS = 14;
  const daysInMonth = new Date(year, month, 0).getDate();
  const wcCount = Math.min(mess.washroomCount, members.length);
  const assignments: { date: Date; washroomNumber: number; memberId: string; messId: string }[] = [];

  let memberIndex = 0;
  for (let day = 1; day <= daysInMonth; day += INTERVAL_DAYS) {
    const date = new Date(year, month - 1, day);
    for (let wn = 1; wn <= wcCount; wn++) {
      assignments.push({
        date,
        washroomNumber: wn,
        memberId: members[memberIndex % members.length].id,
        messId,
      });
      memberIndex++;
    }
  }

  await prisma.washroomCleaning.createMany({ data: assignments });

  return NextResponse.json({ success: true, count: assignments.length });
}

// PATCH - Mark duty as done/skipped (member marks own, manager marks any)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "id and status are required" }, { status: 400 });
  }

  const duty = await prisma.washroomCleaning.findUnique({ where: { id } });
  if (!duty) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Members can only mark their own duties
  if (session.user.role !== "MANAGER" && duty.memberId !== session.user.id) {
    return NextResponse.json({ error: "You can only update your own duties" }, { status: 403 });
  }

  const updated = await prisma.washroomCleaning.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(updated);
}

// DELETE - Delete entire month's schedule (manager only)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));

  if (!month || !year) {
    return NextResponse.json({ error: "Month and year are required" }, { status: 400 });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const result = await prisma.washroomCleaning.deleteMany({
    where: { date: { gte: startDate, lte: endDate }, messId },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}
