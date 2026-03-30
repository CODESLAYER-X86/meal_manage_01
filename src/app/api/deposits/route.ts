import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET deposits
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
    const deposits = await prisma.deposit.findMany({
      where: { date: { gte: startDate, lte: endDate }, messId },
      include: { member: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(deposits);
  }

  const deposits = await prisma.deposit.findMany({
    where: { messId },
    include: { member: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
    take: 50,
  });
  return NextResponse.json(deposits);
}

// POST - record a deposit (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { date, memberId, amount, note } = body;

  if (!date || !memberId || !amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Valid date, memberId, and positive amount required" }, { status: 400 });
  }

  // Verify member belongs to the same mess
  const member = await prisma.user.findFirst({
    where: { id: memberId, messId, isActive: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Member not found in this mess" }, { status: 404 });
  }

  const deposit = await prisma.deposit.create({
    data: {
      date: new Date(date),
      memberId,
      messId,
      amount,
      note,
    },
  });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "Deposit",
    recordId: deposit.id,
    fieldName: "amount",
    oldValue: null,
    newValue: `৳${amount} from ${member.name}`,
    action: "CREATE",
  });

  return NextResponse.json(deposit);
}

// PATCH - edit a deposit (manager only)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { id, amount, note, date } = body;

  if (!id) {
    return NextResponse.json({ error: "Deposit ID required" }, { status: 400 });
  }

  const existing = await prisma.deposit.findFirst({
    where: { id, messId },
    include: { member: { select: { name: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }

  const updateData: { amount?: number; note?: string; date?: Date } = {};
  if (amount !== undefined) {
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }
    updateData.amount = amount;
  }
  if (note !== undefined) {
    if (typeof note === "string" && note.length > 500) {
      return NextResponse.json({ error: "Note too long (max 500 chars)" }, { status: 400 });
    }
    updateData.note = note;
  }
  if (date !== undefined) updateData.date = new Date(date);

  const updated = await prisma.deposit.update({
    where: { id },
    data: updateData,
  });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "Deposit",
    recordId: id,
    fieldName: "amount",
    oldValue: `৳${existing.amount}`,
    newValue: `৳${updated.amount} (${existing.member?.name})`,
    action: "UPDATE",
  });

  return NextResponse.json(updated);
}

// DELETE - remove a deposit (manager only)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Deposit ID required" }, { status: 400 });
  }

  const existing = await prisma.deposit.findFirst({
    where: { id, messId },
    include: { member: { select: { name: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }

  await prisma.deposit.delete({ where: { id } });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "Deposit",
    recordId: id,
    fieldName: "all",
    oldValue: `৳${existing.amount} from ${existing.member?.name}`,
    newValue: null,
    action: "DELETE",
  });

  return NextResponse.json({ success: true });
}
