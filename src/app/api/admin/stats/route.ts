import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user || !(session.user.isAdmin || session.user.isOfficer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [totalUsers, totalMesses, totalMeals, totalDeposits, totalBazarTrips, totalAuditLogs] = await Promise.all([
    prisma.user.count(),
    prisma.mess.count(),
    prisma.mealEntry.count(),
    prisma.deposit.aggregate({ _sum: { amount: true } }),
    prisma.bazarTrip.count(),
    prisma.auditLog.count(),
  ]);

  // Recent signups (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentSignups = await prisma.user.count({
    where: { createdAt: { gte: weekAgo } },
  });

  // Active messes (with at least 1 member)
  const activeMesses = await prisma.mess.count({
    where: { members: { some: {} } },
  });

  return NextResponse.json({
    totalUsers,
    totalMesses,
    activeMesses,
    totalMeals,
    totalDeposits: totalDeposits._sum.amount || 0,
    totalBazarTrips,
    totalAuditLogs,
    recentSignups,
  });
}
