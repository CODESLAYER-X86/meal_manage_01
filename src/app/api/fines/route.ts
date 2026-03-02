import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET - List all fines for the mess (optional ?memberId= filter)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");

  const fines = await prisma.fine.findMany({
    where: {
      messId,
      ...(memberId ? { memberId } : {}),
    },
    include: {
      member: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(fines);
}

// POST - Manager creates a fine for a member
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { memberId, amount, reason } = body;

  if (!memberId || !amount || Number(amount) <= 0 || !reason?.trim()) {
    return NextResponse.json(
      { error: "memberId, a positive amount, and a reason are required" },
      { status: 400 }
    );
  }

  // Verify the member belongs to this mess
  const member = await prisma.user.findFirst({
    where: { id: memberId, messId, isActive: true },
    select: { id: true, name: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Member not found in this mess" }, { status: 404 });
  }

  const fine = await prisma.fine.create({
    data: {
      memberId,
      messId,
      amount: Number(amount),
      reason: reason.trim(),
      createdById: session.user.id,
    },
    include: {
      member: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      editedById: session.user.id,
      messId,
      tableName: "Fine",
      recordId: fine.id,
      fieldName: "all",
      newValue: JSON.stringify({ memberId, amount, reason }),
      action: "CREATE",
    },
  });

  return NextResponse.json({ success: true, fine });
}

// PATCH - Settle a fine (member settles their own fine; adds to their deposit)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "Fine id is required" }, { status: 400 });
  }

  const fine = await prisma.fine.findUnique({ where: { id } });
  if (!fine || fine.messId !== messId) {
    return NextResponse.json({ error: "Fine not found" }, { status: 404 });
  }
  if (fine.settled) {
    return NextResponse.json({ error: "Fine is already settled" }, { status: 400 });
  }

  // Members can only settle their own fines; managers can settle any
  if (session.user.role !== "MANAGER" && fine.memberId !== session.user.id) {
    return NextResponse.json({ error: "You can only settle your own fines" }, { status: 403 });
  }

  // Mark the fine as settled and create a Deposit record for the member
  const [updatedFine] = await prisma.$transaction([
    prisma.fine.update({
      where: { id },
      data: { settled: true, settledAt: new Date() },
      include: {
        member: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.deposit.create({
      data: {
        memberId: fine.memberId,
        messId,
        amount: fine.amount,
        note: `Fine payment: ${fine.reason}`,
        date: new Date(),
      },
    }),
  ]);

  // Audit log
  await prisma.auditLog.create({
    data: {
      editedById: session.user.id,
      messId,
      tableName: "Fine",
      recordId: id,
      fieldName: "settled",
      oldValue: "false",
      newValue: "true",
      action: "UPDATE",
    },
  });

  return NextResponse.json({ success: true, fine: updatedFine });
}

// DELETE - Manager deletes an unsettled fine
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Fine id is required" }, { status: 400 });
  }

  const fine = await prisma.fine.findUnique({ where: { id } });
  if (!fine || fine.messId !== messId) {
    return NextResponse.json({ error: "Fine not found" }, { status: 404 });
  }
  if (fine.settled) {
    return NextResponse.json({ error: "Cannot delete a settled fine" }, { status: 400 });
  }

  await prisma.fine.delete({ where: { id } });

  // Audit log
  await prisma.auditLog.create({
    data: {
      editedById: session.user.id,
      messId,
      tableName: "Fine",
      recordId: id,
      fieldName: "all",
      oldValue: JSON.stringify(fine),
      action: "DELETE",
    },
  });

  return NextResponse.json({ success: true });
}
