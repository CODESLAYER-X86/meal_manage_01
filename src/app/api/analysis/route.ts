import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
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

    // 2. Daily Trends (Current Month: Daily Cost)
    const bazarTrips = await prisma.bazarTrip.findMany({
      where: { messId, date: { gte: startOfCurrentMonth } },
      select: { date: true, totalCost: true },
    });

    const daysInMonth = new Date(bdNow.getFullYear(), bdNow.getMonth() + 1, 0).getDate();
    const dailyTrends = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      cost: 0,
    }));

    bazarTrips.forEach((trip) => {
      const tripDay = new Date(trip.date).getDate() - 1; // 0-indexed for array
      if (tripDay >= 0 && tripDay < daysInMonth) {
        dailyTrends[tripDay].cost += trip.totalCost;
      }
    });

    return NextResponse.json({
      costBreakdown,
      dailyTrends,
    });
  } catch (error) {
    console.error("Analysis API Error:", error);
    return NextResponse.json({ error: "Failed to fetch analysis data" }, { status: 500 });
  }
}
