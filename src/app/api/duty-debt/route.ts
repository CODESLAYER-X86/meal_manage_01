import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET duty debts for the mess
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // "PENDING" | "SETTLED" | null (all)
  const memberId = searchParams.get("memberId"); // filter by specific member

  const where: Record<string, unknown> = { messId };
  if (status) where.status = status;
  if (memberId) {
    where.OR = [{ owedById: memberId }, { owedToId: memberId }];
  }

  const debts = await prisma.dutyDebt.findMany({
    where,
    include: {
      owedBy: { select: { id: true, name: true } },
      owedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ debts });
}

// PATCH - Settle a duty debt (manager or the person who is owed)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "Debt id is required" }, { status: 400 });
  }

  const debt = await prisma.dutyDebt.findUnique({ where: { id } });
  if (!debt || debt.messId !== session.user.messId) {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }

  // Only manager or the person who covered the duty can settle
  const isManager = session.user.role === "MANAGER";
  if (!isManager && debt.owedToId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the manager or the person who covered can settle this debt" },
      { status: 403 }
    );
  }

  const updated = await prisma.dutyDebt.update({
    where: { id },
    data: { status: "SETTLED", settledAt: new Date(), updatedAt: new Date() },
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      editedById: session.user.id,
      messId: session.user.messId,
      tableName: "DutyDebt",
      recordId: id,
      fieldName: "status",
      oldValue: "PENDING",
      newValue: "SETTLED",
      action: "UPDATE",
    },
  });

  return NextResponse.json({ success: true, debt: updated });
}
