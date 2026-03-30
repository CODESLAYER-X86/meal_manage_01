import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET - List bazar duty schedule
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

  const duties = await prisma.bazarDutySchedule.findMany({
    where: { messId, date: { gte: startDate, lte: endDate } },
    include: { member: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ duties, members });
}

// POST - Create duty assignments (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Manager only" }, { status: 403 });
  }
  const messId = session.user.messId;
  const body = await request.json();

  // Single assignment: { date, memberId }
  // Bulk auto-rotate: { autoRotate: true, startDate, endDate }
  if (body.autoRotate) {
    const { startDate, endDate } = body;
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required for auto-rotate" }, { status: 400 });
    }
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
    const assignments: { date: Date; memberId: string; messId: string }[] = [];
    let idx = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      assignments.push({
        date: new Date(d),
        memberId: members[idx % members.length].id,
        messId,
      });
      idx++;
    }

    // Delete existing duties in range, then create new ones
    await prisma.bazarDutySchedule.deleteMany({
      where: { messId, date: { gte: start, lte: end } },
    });
    await prisma.bazarDutySchedule.createMany({ data: assignments });

    await createAuditLog({
      editedById: session.user.id,
      messId,
      tableName: "BazarDutySchedule",
      recordId: "bulk",
      fieldName: "autoRotate",
      oldValue: null,
      newValue: `${assignments.length} duties from ${startDate} to ${endDate}`,
      action: "CREATE",
    });

    return NextResponse.json({ success: true, count: assignments.length });
  }

  // Single assignment
  const { date, memberId } = body;
  if (!date || !memberId) {
    return NextResponse.json({ error: "date and memberId required" }, { status: 400 });
  }

  // Verify member belongs to this mess
  const targetMember = await prisma.user.findFirst({ where: { id: memberId, messId, isActive: true } });
  if (!targetMember) {
    return NextResponse.json({ error: "Member not found in this mess" }, { status: 404 });
  }

  const duty = await prisma.bazarDutySchedule.create({
    data: { date: new Date(date + "T00:00:00.000Z"), memberId, messId },
    include: { member: { select: { id: true, name: true } } },
  });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "BazarDutySchedule",
    recordId: duty.id,
    fieldName: "assignment",
    oldValue: null,
    newValue: `${duty.member.name} on ${date}`,
    action: "CREATE",
  });

  return NextResponse.json({ success: true, duty });
}

// PATCH - Mark duty completed/incomplete, create debt if incomplete
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;
  const isManager = session.user.role === "MANAGER";
  const body = await request.json();
  const { id, completed } = body;

  if (!id) {
    return NextResponse.json({ error: "Duty id required" }, { status: 400 });
  }

  const duty = await prisma.bazarDutySchedule.findUnique({
    where: { id },
    include: { member: { select: { id: true, name: true } } },
  });
  if (!duty || duty.messId !== messId) {
    return NextResponse.json({ error: "Duty not found" }, { status: 404 });
  }

  // Only manager or assigned member can update
  if (!isManager && duty.memberId !== session.user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.bazarDutySchedule.update({
    where: { id },
    data: { completed: completed ?? true },
  });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "BazarDutySchedule",
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

  const duty = await prisma.bazarDutySchedule.findUnique({ where: { id } });
  if (!duty || duty.messId !== messId) {
    return NextResponse.json({ error: "Duty not found" }, { status: 404 });
  }

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "BazarDutySchedule",
    recordId: id,
    fieldName: "deletion",
    oldValue: `${duty.date.toISOString().split("T")[0]}`,
    newValue: null,
    action: "DELETE",
  });

  await prisma.bazarDutySchedule.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
