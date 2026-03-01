import { NextRequest, NextResponse } from "next/server";
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

  const deposit = await prisma.deposit.create({
    data: {
      date: new Date(date),
      memberId,
      messId,
      amount,
      note,
    },
  });

  const member = await prisma.user.findUnique({ where: { id: memberId } });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "Deposit",
    recordId: deposit.id,
    fieldName: "amount",
    oldValue: null,
    newValue: `৳${amount} from ${member?.name}`,
    action: "CREATE",
  });

  return NextResponse.json(deposit);
}
