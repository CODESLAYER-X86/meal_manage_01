import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET audit logs
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || "50");
  const tableName = searchParams.get("table");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");

  const where: Record<string, unknown> = { messId: session.user.messId };
  if (tableName) where.tableName = tableName;

  // Date range filter
  if (fromDate || toDate) {
    const createdAt: Record<string, Date> = {};
    if (fromDate) createdAt.gte = new Date(fromDate);
    if (toDate) {
      // Set to end of the day
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    where.createdAt = createdAt;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      editedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(logs);
}
