import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET bazar duties for a month
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const duties = await prisma.bazarDuty.findMany({
    where: { messId, date: { gte: startDate, lte: endDate } },
    include: { member: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const mess = await prisma.mess.findUnique({
    where: { id: messId },
    select: { bazarDaysPerWeek: true },
  });

  return NextResponse.json({ duties, members, bazarDaysPerWeek: mess?.bazarDaysPerWeek ?? 3 });
}

// POST - Generate bazar duty rotation for a month (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { month, year } = body;

  if (!month || !year) {
    return NextResponse.json({ error: "Month and year are required" }, { status: 400 });
  }

  const mess = await prisma.mess.findUnique({
    where: { id: messId },
    select: { bazarDaysPerWeek: true },
  });
  const daysPerWeek = mess?.bazarDaysPerWeek ?? 3;

  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true },
    orderBy: { name: "asc" },
  });

  if (members.length === 0) {
    return NextResponse.json({ error: "No active members" }, { status: 400 });
  }

  // Check existing
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const existing = await prisma.bazarDuty.findFirst({
    where: { messId, date: { gte: startDate, lte: endDate } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Bazar rotation already exists for this month. Delete it first to regenerate." },
      { status: 400 }
    );
  }

  // Generate rotation: distribute daysPerWeek bazar days across the month
  // Pick specific weekdays based on daysPerWeek (e.g., 3 → Sat, Tue, Thu)
  const bazarWeekdays = getBazarWeekdays(daysPerWeek);
  const daysInMonth = new Date(year, month, 0).getDate();
  const assignments: { date: Date; memberId: string; messId: string }[] = [];
  let memberIndex = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay(); // 0=Sun, 6=Sat
    if (bazarWeekdays.includes(dow)) {
      assignments.push({
        date,
        memberId: members[memberIndex % members.length].id,
        messId,
      });
      memberIndex++;
    }
  }

  if (assignments.length === 0) {
    return NextResponse.json({ error: "No bazar days generated" }, { status: 400 });
  }

  await prisma.bazarDuty.createMany({ data: assignments });

  return NextResponse.json({ success: true, count: assignments.length });
}

// PATCH - Update a bazar duty (mark done, reassign)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, action } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }

  const duty = await prisma.bazarDuty.findUnique({ where: { id } });
  if (!duty || duty.messId !== session.user.messId) {
    return NextResponse.json({ error: "Duty not found" }, { status: 404 });
  }

  const messId = session.user.messId;
  const isManager = session.user.role === "MANAGER";

  if (action === "done") {
    // Member marks own duty done, or manager marks any
    if (!isManager && duty.memberId !== session.user.id) {
      return NextResponse.json({ error: "You can only mark your own duties" }, { status: 403 });
    }
    const updated = await prisma.bazarDuty.update({
      where: { id },
      data: { status: "DONE", updatedAt: new Date() },
    });
    return NextResponse.json({ success: true, duty: updated });
  }

  if (action === "reassign") {
    // Manager reassigns duty to another member → creates duty debt
    if (!isManager) {
      return NextResponse.json({ error: "Only manager can reassign" }, { status: 403 });
    }
    const { newMemberId, reason } = body;
    if (!newMemberId) {
      return NextResponse.json({ error: "newMemberId is required" }, { status: 400 });
    }

    const originalMemberId = duty.originalMemberId || duty.memberId;

    const updated = await prisma.bazarDuty.update({
      where: { id },
      data: {
        memberId: newMemberId,
        originalMemberId: originalMemberId,
        note: reason || null,
        updatedAt: new Date(),
      },
    });

    // Create duty debt: original member owes the new member
    await prisma.dutyDebt.create({
      data: {
        owedById: originalMemberId,
        owedToId: newMemberId,
        messId,
        dutyType: "BAZAR",
        reason: reason || `Bazar duty reassigned for ${duty.date.toISOString().split("T")[0]}`,
      },
    });

    // Audit
    await prisma.auditLog.create({
      data: {
        editedById: session.user.id,
        messId,
        tableName: "BazarDuty",
        recordId: id,
        fieldName: "memberId",
        oldValue: duty.memberId,
        newValue: newMemberId,
        action: "REASSIGN",
      },
    });

    return NextResponse.json({ success: true, duty: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// DELETE - Delete month's bazar rotation (manager only)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));

  if (!month || !year) {
    return NextResponse.json({ error: "Month and year required" }, { status: 400 });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const result = await prisma.bazarDuty.deleteMany({
    where: { messId: session.user.messId, date: { gte: startDate, lte: endDate } },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}

// Helper: pick weekdays based on days per week
function getBazarWeekdays(daysPerWeek: number): number[] {
  // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  switch (daysPerWeek) {
    case 1: return [6]; // Sat
    case 2: return [3, 6]; // Wed, Sat
    case 3: return [2, 4, 6]; // Tue, Thu, Sat
    case 4: return [1, 3, 5, 6]; // Mon, Wed, Fri, Sat
    case 5: return [1, 2, 3, 4, 6]; // Mon-Thu, Sat
    case 6: return [1, 2, 3, 4, 5, 6]; // Mon-Sat
    case 7: return [0, 1, 2, 3, 4, 5, 6]; // Every day
    default: return [2, 4, 6]; // Default: Tue, Thu, Sat
  }
}
