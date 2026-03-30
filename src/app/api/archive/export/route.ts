import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — Export ALL data for a given month as a .messmate archive file
// Query params: month, year
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));

  if (!month || !year) {
    return NextResponse.json({ error: "month and year are required" }, { status: 400 });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Fetch all data for this month in parallel
  const [
    mess,
    members,
    mealEntries,
    deposits,
    bazarTrips,
    auditLogs,
    washroomDuties,
    managerRotations,
    mealPlans,
    mealOffRequests,
    announcements,
    mealRatings,
    mealVoteTopics,
    billSettings,
    billPayments,
    memberPresence,
  ] = await Promise.all([
    prisma.mess.findUnique({ where: { id: messId }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { messId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    }),
    prisma.mealEntry.findMany({
      where: { messId, date: { gte: startDate, lte: endDate } },
      include: { member: { select: { id: true, name: true } } },
    }),
    prisma.deposit.findMany({
      where: { messId, date: { gte: startDate, lte: endDate } },
      include: { member: { select: { id: true, name: true } } },
    }),
    prisma.bazarTrip.findMany({
      where: { messId, date: { gte: startDate, lte: endDate } },
      include: {
        buyer: { select: { id: true, name: true } },
        items: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { messId, createdAt: { gte: startDate, lte: endDate } },
      include: { editedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.washroomCleaning.findMany({
      where: { messId, date: { gte: startDate, lte: endDate } },
      include: { member: { select: { id: true, name: true } } },
    }),
    prisma.managerRotation.findMany({
      where: { messId, month, year },
      include: { member: { select: { id: true, name: true } } },
    }),
    prisma.mealPlan.findMany({
      where: { messId, date: { gte: startDate, lte: endDate } },
    }),
    prisma.mealOffRequest.findMany({
      where: { messId, fromDate: { lte: endDate }, toDate: { gte: startDate } },
      include: { member: { select: { id: true, name: true } } },
    }),
    prisma.announcement.findMany({
      where: { messId, createdAt: { gte: startDate, lte: endDate } },
      include: { author: { select: { id: true, name: true } } },
    }),
    prisma.mealRating.findMany({
      where: { messId, date: { gte: startDate, lte: endDate } },
      include: { member: { select: { id: true, name: true } } },
    }),
    prisma.mealVoteTopic.findMany({
      where: { messId, createdAt: { gte: startDate, lte: endDate } },
      include: { votes: { include: { voter: { select: { id: true, name: true } } } } },
    }),
    prisma.billSetting.findMany({
      where: { messId, month, year },
    }),
    prisma.billPayment.findMany({
      where: { messId, month, year },
      include: { member: { select: { id: true, name: true } } },
    }),
    prisma.memberPresence.findMany({
      where: { messId },
      include: { member: { select: { id: true, name: true } } },
    }),
  ]);

  // Calculate billing summary
  const totalExpense = bazarTrips.reduce((sum, trip) => sum + trip.totalCost, 0);
  const totalMeals = mealEntries.reduce((sum, e) => sum + e.total, 0);
  const mealRate = totalMeals > 0 ? Math.round((totalExpense / totalMeals) * 100) / 100 : 0;

  const memberBilling = members.map((m) => {
    const meals = mealEntries.filter((e) => e.memberId === m.id).reduce((s, e) => s + e.total, 0);
    const dep = deposits.filter((d) => d.memberId === m.id).reduce((s, d) => s + d.amount, 0);
    const cost = Math.round(meals * mealRate * 100) / 100;
    return { id: m.id, name: m.name, totalMeals: meals, mealCost: cost, totalDeposit: dep, netDue: Math.round((cost - dep) * 100) / 100 };
  });

  const archive = {
    _format: "messmate-archive",
    _version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: { id: session.user.id, name: session.user.name },
    period: { month, year },
    mess,
    members,
    billing: { totalExpense, totalMeals, mealRate, members: memberBilling },
    data: {
      mealEntries,
      deposits,
      bazarTrips,
      auditLogs,
      washroomDuties,
      managerRotations,
      mealPlans,
      mealOffRequests,
      announcements,
      mealRatings,
      mealVoteTopics,
      billSettings,
      billPayments,
      memberPresence,
    },
  };

  // Create integrity hash — simple checksum of stringified data
  const jsonStr = JSON.stringify(archive);
  const hash = await computeHash(jsonStr);

  const payload = JSON.stringify({ archive, _checksum: hash });

  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", { month: "short" });
  const fileName = `messmate-${mess?.name?.replace(/\s+/g, "-").toLowerCase() || "archive"}-${monthName}-${year}.messmate`;

  return new NextResponse(payload, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = encoder.encode(data);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const hashArray = Array.from(new Uint8Array(hashBuf));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
