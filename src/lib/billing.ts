import prisma from "@/lib/prisma";

export interface MonthlyBillResult {
  totalExpense: number;
  totalMeals: number;
  mealRate: number;
  members: {
    id: string;
    name: string;
    totalMeals: number;
    mealCost: number;
    totalDeposit: number;
    netDue: number; // positive = owes money, negative = gets refund
  }[];
}

export async function calculateMonthlyBill(
  month: number,
  year: number,
  messId: string
): Promise<MonthlyBillResult> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Get all active members in this mess
  const members = await prisma.user.findMany({
    where: {
      messId,
      OR: [
        { isActive: true },
        {
          leaveDate: { gte: startDate },
        },
      ],
    },
  });

  // Get total bazar expenses for the month in this mess (ONLY approved trips)
  const bazarTrips = await prisma.bazarTrip.findMany({
    where: {
      messId,
      approved: true,
      date: { gte: startDate, lte: endDate },
    },
  });
  const totalExpense = bazarTrips.reduce((sum, trip) => sum + trip.totalCost, 0);

  // Get all meal entries for the month in this mess
  const mealEntries = await prisma.mealEntry.findMany({
    where: {
      messId,
      date: { gte: startDate, lte: endDate },
    },
  });

  // Get all deposits for the month in this mess
  const deposits = await prisma.deposit.findMany({
    where: {
      messId,
      date: { gte: startDate, lte: endDate },
    },
  });

  // Calculate total meals
  const totalMeals = mealEntries.reduce((sum, entry) => sum + entry.total, 0);

  // Meal rate
  const mealRate = totalMeals > 0 ? totalExpense / totalMeals : 0;

  // Per-member breakdown
  const memberResults = members.map((member) => {
    const memberMeals = mealEntries
      .filter((e) => e.memberId === member.id)
      .reduce((sum, e) => sum + e.total, 0);

    const memberDeposits = deposits
      .filter((d) => d.memberId === member.id)
      .reduce((sum, d) => sum + d.amount, 0);

    const mealCost = memberMeals * mealRate;
    const netDue = mealCost - memberDeposits; // positive = owes, negative = refund

    return {
      id: member.id,
      name: member.name,
      totalMeals: memberMeals,
      mealCost: Math.round(mealCost * 100) / 100,
      totalDeposit: memberDeposits,
      netDue: Math.round(netDue * 100) / 100,
    };
  });

  return {
    totalExpense,
    totalMeals,
    mealRate: Math.round(mealRate * 100) / 100,
    members: memberResults,
  };
}
