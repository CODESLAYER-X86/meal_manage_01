import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startOfMonth, subMonths, format } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized or no mess assigned" }, { status: 401 });
  }

  const messId = session.user.messId;

  try {
    // Helper: get Bangladesh time
    const now = new Date();
    const bdNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    
    // 1. Current Month Cost Breakdown (BazarItems)
    const startOfCurrentMonth = startOfMonth(bdNow);
    
    // Get all bazar items for trips in this month
    const currentMonthItems = await prisma.bazarItem.findMany({
      where: {
        trip: {
          messId: messId,
          date: { gte: startOfCurrentMonth },
        },
      },
      select: {
        itemName: true,
        normalizedName: true,
        price: true,
      },
    });

    // Aggregate by name
    const breakdownMap: Record<string, number> = {};
    for (const item of currentMonthItems) {
      // Use normalizedName if available, else uppercase itemName for grouping
      const name = item.normalizedName || item.itemName.trim().toUpperCase();
      breakdownMap[name] = (breakdownMap[name] || 0) + item.price;
    }

    const costBreakdown = Object.entries(breakdownMap)
      .map(([name, total]) => ({ name, value: total }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 items

    // 2. Monthly Trends (Last 6 Months: Total Cost vs Total Meals)
    const sixMonthsAgo = startOfMonth(subMonths(bdNow, 5));

    const [bazarTrips, mealEntries] = await Promise.all([
      prisma.bazarTrip.findMany({
        where: { messId, date: { gte: sixMonthsAgo } },
        select: { date: true, totalCost: true },
      }),
      prisma.mealEntry.findMany({
        where: { messId, date: { gte: sixMonthsAgo } },
        select: { date: true, total: true },
      }),
    ]);

    // Grouping Trends data by "MMM yyyy"
    const trendsMap: Record<string, { month: string; sortOrder: Date; cost: number; meals: number }> = {};
    
    // Initialize last 6 months placeholder
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(bdNow, i));
      const key = format(d, "MMM yyyy");
      trendsMap[key] = { month: key, sortOrder: d, cost: 0, meals: 0 };
    }

    bazarTrips.forEach((trip) => {
      const key = format(trip.date, "MMM yyyy");
      if (trendsMap[key]) {
        trendsMap[key].cost += trip.totalCost;
      }
    });

    mealEntries.forEach((entry) => {
      const key = format(entry.date, "MMM yyyy");
      if (trendsMap[key]) {
        trendsMap[key].meals += entry.total;
      }
    });

    const monthlyTrends = Object.values(trendsMap)
      .sort((a, b) => a.sortOrder.getTime() - b.sortOrder.getTime())
      .map(({ month, cost, meals }) => ({
        month,
        cost,
        meals,
        // Optional: calculate meal rate for tooltip
        rate: meals > 0 ? parseFloat((cost / meals).toFixed(2)) : 0
      }));

    return NextResponse.json({
      costBreakdown,
      monthlyTrends,
    });
  } catch (error) {
    console.error("Analysis API Error:", error);
    return NextResponse.json({ error: "Failed to fetch analysis data" }, { status: 500 });
  }
}
