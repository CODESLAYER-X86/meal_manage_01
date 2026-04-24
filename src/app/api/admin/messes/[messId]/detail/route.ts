import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/admin/messes/[messId]/detail — full mess inspection
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messId: string }> }
) {
  const session = await auth();
  if (!session?.user || !(session.user.isAdmin || session.user.isOfficer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { messId } = await params;

  try {
    const mess = await prisma.mess.findUnique({
      where: { id: messId },
      include: {
        createdBy: { select: { name: true, email: true } },
        members: {
          select: {
            id: true, name: true, email: true, phone: true,
            role: true, isActive: true, joinDate: true,
          },
          orderBy: { role: "asc" },
        },
      },
    });

    if (!mess) {
      return NextResponse.json({ error: "Mess not found" }, { status: 404 });
    }

    // Get current month stats
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [mealEntries, deposits, bazarTrips, recentActivity] = await Promise.all([
      // This month's meal entries
      prisma.mealEntry.findMany({
        where: { messId, date: { gte: monthStart, lte: monthEnd } },
        include: { member: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 100,
      }),
      // This month's deposits
      prisma.deposit.findMany({
        where: { messId, date: { gte: monthStart, lte: monthEnd } },
        include: { member: { select: { name: true } } },
        orderBy: { date: "desc" },
      }),
      // This month's bazar trips
      prisma.bazarTrip.findMany({
        where: { messId, approved: true, date: { gte: monthStart, lte: monthEnd } },
        include: {
          buyer: { select: { name: true } },
          items: true,
        },
        orderBy: { date: "desc" },
      }),
      // Last 20 audit log entries
      prisma.auditLog.findMany({
        where: { messId },
        include: { editedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    // Aggregate stats
    const totalMealsThisMonth = mealEntries.reduce((sum, e) => sum + e.total, 0);
    const totalDepositsThisMonth = deposits.reduce((sum, d) => sum + d.amount, 0);
    const totalBazarThisMonth = bazarTrips.reduce((sum, t) => sum + t.totalCost, 0);
    const mealRate = totalMealsThisMonth > 0 ? totalBazarThisMonth / totalMealsThisMonth : 0;

    return NextResponse.json({
      mess: {
        id: mess.id,
        name: mess.name,
        inviteCode: mess.inviteCode,
        createdBy: mess.createdBy,
        createdAt: mess.createdAt,
        settings: {
          washroomCount: mess.washroomCount,
          dueThreshold: mess.dueThreshold,
          bazarDaysPerWeek: mess.bazarDaysPerWeek,
          hasGas: mess.hasGas,
          hasCook: mess.hasCook,
          autoMealEntry: mess.autoMealEntry,
          mealsPerDay: mess.mealsPerDay,
          mealTypes: mess.mealTypes,
          mealBlackouts: mess.mealBlackouts,
        },
      },
      members: mess.members,
      stats: {
        totalMealsThisMonth: Math.round(totalMealsThisMonth * 100) / 100,
        totalDepositsThisMonth,
        totalBazarThisMonth,
        mealRate: Math.round(mealRate * 100) / 100,
        memberCount: mess.members.length,
      },
      recentMeals: mealEntries.slice(0, 30).map((e) => ({
        date: e.date.toISOString().split("T")[0],
        member: e.member.name,
        breakfast: e.breakfast,
        lunch: e.lunch,
        dinner: e.dinner,
        total: e.total,
      })),
      recentDeposits: deposits.map((d) => ({
        date: d.date.toISOString().split("T")[0],
        member: d.member.name,
        amount: d.amount,
        note: d.note,
      })),
      recentBazar: bazarTrips.map((t) => ({
        date: t.date.toISOString().split("T")[0],
        buyer: t.buyer.name,
        totalCost: t.totalCost,
        itemCount: t.items.length,
        items: t.items.map((i) => ({
          name: i.itemName,
          quantity: i.quantity,
          unit: i.unit,
          price: i.price,
        })),
      })),
      recentActivity: recentActivity.map((a) => ({
        action: a.action,
        table: a.tableName,
        field: a.fieldName,
        oldValue: a.oldValue,
        newValue: a.newValue,
        editedBy: a.editedBy.name,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
