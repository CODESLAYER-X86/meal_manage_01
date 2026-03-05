import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET - List washroom duty schedule
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;
  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const duties = await prisma.washroomDutySchedule.findMany({
    where: { messId, date: { gte: startDate, lte: endDate } },
    include: { member: { select: { id: true, name: true } } },
    orderBy: [{ date: "asc" }, { washroomNumber: "asc" }],
  });

  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const debts = await prisma.dutyDebt.findMany({
    where: { messId, dutyType: "WASHROOM", status: "PENDING" },
    include: {
      owedBy: { select: { id: true, name: true } },
      owedTo: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ duties, members, debts });
}

// POST - Create washroom duty assignments (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Manager only" }, { status: 403 });
  }
  const messId = session.user.messId;
  const body = await request.json();

  if (body.autoRotate) {
    const { startDate, endDate, washroomCount } = body;
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }
    const numWashrooms = washroomCount || 1;
    const members = await prisma.user.findMany({
      where: { messId, isActive: true },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    if (members.length === 0) {
      return NextResponse.json({ error: "No active members" }, { status: 400 });
    }

    const start = new Date(startDate + "T00:00:00.000Z");
    const end = new Date(endDate + "T00:00:00.000Z");
    const assignments: { date: Date; memberId: string; messId: string; washroomNumber: number }[] = [];
    let idx = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      for (let w = 1; w <= numWashrooms; w++) {
        assignments.push({
          date: new Date(d),
          memberId: members[idx % members.length].id,
          messId,
          washroomNumber: w,
        });
        idx++;
      }
    }

    await prisma.washroomDutySchedule.deleteMany({
      where: { messId, date: { gte: start, lte: end } },
    });
    await prisma.washroomDutySchedule.createMany({ data: assignments });

    await createAuditLog({
      editedById: session.user.id,
      messId,
      tableName: "WashroomDutySchedule",
      recordId: "bulk",
      fieldName: "autoRotate",
      oldValue: null,
      newValue: `${assignments.length} duties from ${startDate} to ${endDate}`,
      action: "CREATE",
    });

    return NextResponse.json({ success: true, count: assignments.length });
  }

  // Single assignment
  const { date, memberId, washroomNumber } = body;
  if (!date || !memberId) {
    return NextResponse.json({ error: "date and memberId required" }, { status: 400 });
  }

  const duty = await prisma.washroomDutySchedule.create({
    data: {
      date: new Date(date + "T00:00:00.000Z"),
      memberId,
      messId,
      washroomNumber: washroomNumber || 1,
    },
    include: { member: { select: { id: true, name: true } } },
  });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "WashroomDutySchedule",
    recordId: duty.id,
    fieldName: "assignment",
    oldValue: null,
    newValue: `${duty.member.name} on ${date} (WR#${duty.washroomNumber})`,
    action: "CREATE",
  });

  return NextResponse.json({ success: true, duty });
}

// PATCH - Mark duty completed/incomplete
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;
  const isManager = session.user.role === "MANAGER";
  const body = await request.json();
  const { id, completed, coveredById } = body;

  if (!id) {
    return NextResponse.json({ error: "Duty id required" }, { status: 400 });
  }

  const duty = await prisma.washroomDutySchedule.findUnique({
    where: { id },
    include: { member: { select: { id: true, name: true } } },
  });
  if (!duty || duty.messId !== messId) {
    return NextResponse.json({ error: "Duty not found" }, { status: 404 });
  }

  if (!isManager && duty.memberId !== session.user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.washroomDutySchedule.update({
    where: { id },
    data: { completed: completed ?? true },
  });

  if (completed === false && coveredById && coveredById !== duty.memberId) {
    await prisma.dutyDebt.create({
      data: {
        owedById: duty.memberId,
        owedToId: coveredById,
        messId,
        dutyType: "WASHROOM",
        reason: `Missed washroom duty on ${duty.date.toISOString().split("T")[0]} (WR#${duty.washroomNumber})`,
      },
    });
  }

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "WashroomDutySchedule",
    recordId: id,
    fieldName: "completed",
    oldValue: String(duty.completed),
    newValue: String(completed ?? true),
    action: "UPDATE",
  });

  return NextResponse.json({ success: true });
}

// DELETE - Remove duty assignment (manager only)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Manager only" }, { status: 403 });
  }
  const messId = session.user.messId;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Duty id required" }, { status: 400 });
  }

  const duty = await prisma.washroomDutySchedule.findUnique({ where: { id } });
  if (!duty || duty.messId !== messId) {
    return NextResponse.json({ error: "Duty not found" }, { status: 404 });
  }

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "WashroomDutySchedule",
    recordId: id,
    fieldName: "deletion",
    oldValue: `${duty.date.toISOString().split("T")[0]} WR#${duty.washroomNumber}`,
    newValue: null,
    action: "DELETE",
  });

  await prisma.washroomDutySchedule.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
