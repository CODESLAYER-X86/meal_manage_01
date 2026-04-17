import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/admin/analytics — aggregated cross-mess analytics for charts
export async function GET() {
  const session = await auth();
  if (!session?.user || !((session.user as any).isAdmin || (session.user as any).isOfficer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // 1. Daily meal consumption trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyMeals = await prisma.mealEntry.groupBy({
      by: ["date"],
      where: { date: { gte: thirtyDaysAgo } },
      _sum: { total: true },
      _count: true,
      orderBy: { date: "asc" },
    });

    const mealTrend = dailyMeals.map((d) => ({
      date: d.date.toISOString().split("T")[0],
      totalMeals: d._sum.total || 0,
      entries: d._count,
    }));

    // 2. Bazar spending by category
    const bazarByCategory = await prisma.bazarItem.groupBy({
      by: ["category"],
      _sum: { price: true },
      _count: true,
      orderBy: { _sum: { price: "desc" } },
    });

    const categorySpending = bazarByCategory
      .filter((c) => c.category)
      .map((c) => ({
        category: c.category || "Uncategorized",
        totalSpent: c._sum.price || 0,
        itemCount: c._count,
      }));

    // 3. Top 15 most purchased items
    const topItems = await prisma.bazarItem.groupBy({
      by: ["normalizedName"],
      _sum: { price: true, quantity: true },
      _count: true,
      orderBy: { _count: { normalizedName: "desc" } },
      take: 15,
    });

    const topPurchasedItems = topItems
      .filter((i) => i.normalizedName)
      .map((i) => ({
        item: i.normalizedName || "Unknown",
        totalSpent: i._sum?.price || 0,
        totalQuantity: i._sum?.quantity || 0,
        purchaseCount: i._count,
      }));

    // 4. Per-mess comparison (meal rate, members, total meals, total deposits)
    const messes = await prisma.mess.findMany({
      include: {
        _count: { select: { members: true } },
        deposits: { select: { amount: true } },
        bazarTrips: { select: { totalCost: true } },
      },
    });

    const mealSums = await prisma.mealEntry.groupBy({
      by: ["messId"],
      _sum: { total: true },
    });
    const mealSumMap = Object.fromEntries(mealSums.map(m => [m.messId, m._sum.total || 0]));

    const messComparison = messes.map((m) => {
      const totalDeposits = m.deposits.reduce((sum, d) => sum + d.amount, 0);
      const totalBazar = m.bazarTrips.reduce((sum, t) => sum + t.totalCost, 0);
      const totalMeals = mealSumMap[m.id] || 0;
      const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;
      return {
        name: m.name,
        members: m._count.members,
        totalMeals: totalMeals,
        totalDeposits,
        totalBazar,
        mealRate: Math.round(mealRate * 100) / 100,
      };
    });

    // 5. Member activity (active vs away)
    const totalActive = await prisma.user.count({ where: { isActive: true, messId: { not: null } } });
    const totalAway = await prisma.memberPresence.count({ where: { isAway: true } });

    // 6. Monthly spending trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrips = await prisma.bazarTrip.findMany({
      where: { date: { gte: sixMonthsAgo } },
      select: { date: true, totalCost: true },
      orderBy: { date: "asc" },
    });

    const monthlySpending: Record<string, number> = {};
    for (const trip of monthlyTrips) {
      const key = `${trip.date.getFullYear()}-${String(trip.date.getMonth() + 1).padStart(2, "0")}`;
      monthlySpending[key] = (monthlySpending[key] || 0) + trip.totalCost;
    }

    const spendingTrend = Object.entries(monthlySpending).map(([month, total]) => ({
      month,
      total: Math.round(total),
    }));

    // 7. Platform totals
    const [totalUsers, totalMesses, totalMealEntriesSum, totalDepositSum] = await Promise.all([
      prisma.user.count(),
      prisma.mess.count(),
      prisma.mealEntry.aggregate({ _sum: { total: true } }),
      prisma.deposit.aggregate({ _sum: { amount: true } }),
    ]);

    return NextResponse.json({
      mealTrend,
      categorySpending,
      topPurchasedItems,
      messComparison,
      memberActivity: { active: totalActive, away: totalAway },
      spendingTrend,
      totals: {
        users: totalUsers,
        messes: totalMesses,
        mealEntries: totalMealEntriesSum._sum.total || 0,
        deposits: totalDepositSum._sum.amount || 0,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
