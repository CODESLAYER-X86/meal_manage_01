import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET audit logs
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || "50");
  const tableName = searchParams.get("table");

  const where: Record<string, unknown> = {};
  if (tableName) where.tableName = tableName;

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
