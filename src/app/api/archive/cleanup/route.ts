import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST — Auto-cleanup old data (older than 2 months)
// Manager only, or called by Vercel Cron
export async function POST(request: Request) {
  // Check for cron secret or manager auth
  const cronSecret = request.headers.get("authorization");
  const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`;

  let messId: string | undefined;

  if (!isCron) {
    const session = await auth();
    if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    messId = session.user.messId;
  }

  // Calculate cutoff date: 2 months ago from the 1st of current month
  const now = new Date();
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  // End of cutoff month
  const cutoffEnd = new Date(cutoffDate.getFullYear(), cutoffDate.getMonth() + 1, 0, 23, 59, 59);

  // If cron, clean ALL messes. If manager, clean only their mess.
  const messFilter = messId ? { messId } : {};

  // Delete old data in order (to respect foreign keys)
  const results: Record<string, number> = {};

  // 1. BazarItems (via cascade from BazarTrip, but we need to get trip IDs first)
  const oldTrips = await prisma.bazarTrip.findMany({
    where: { ...messFilter, date: { lte: cutoffEnd } },
    select: { id: true },
  });
  if (oldTrips.length > 0) {
    const deleted = await prisma.bazarItem.deleteMany({
      where: { tripId: { in: oldTrips.map((t) => t.id) } },
    });
    results.bazarItems = deleted.count;
  }

  // 2. BazarTrips
  const r2 = await prisma.bazarTrip.deleteMany({
    where: { ...messFilter, date: { lte: cutoffEnd } },
  });
  results.bazarTrips = r2.count;

  // 3. MealEntries
  const r3 = await prisma.mealEntry.deleteMany({
    where: { ...messFilter, date: { lte: cutoffEnd } },
  });
  results.mealEntries = r3.count;

  // 4. Deposits
  const r4 = await prisma.deposit.deleteMany({
    where: { ...messFilter, date: { lte: cutoffEnd } },
  });
  results.deposits = r4.count;

  // 5. Audit Logs
  const r5 = await prisma.auditLog.deleteMany({
    where: { ...messFilter, createdAt: { lte: cutoffEnd } },
  });
  results.auditLogs = r5.count;

  // 6. WashroomCleaning
  const r6 = await prisma.washroomCleaning.deleteMany({
    where: { ...messFilter, date: { lte: cutoffEnd } },
  });
  results.washroomDuties = r6.count;

  // 7. MealPlans
  const r7 = await prisma.mealPlan.deleteMany({
    where: { ...messFilter, date: { lte: cutoffEnd } },
  });
  results.mealPlans = r7.count;

  // 8. MealOffRequests
  const r8 = await prisma.mealOffRequest.deleteMany({
    where: { ...messFilter, toDate: { lte: cutoffEnd } },
  });
  results.mealOffRequests = r8.count;

  // 9. Announcements
  const r9 = await prisma.announcement.deleteMany({
    where: { ...messFilter, createdAt: { lte: cutoffEnd } },
  });
  results.announcements = r9.count;

  // 10. MealRatings
  const r10 = await prisma.mealRating.deleteMany({
    where: { ...messFilter, date: { lte: cutoffEnd } },
  });
  results.mealRatings = r10.count;

  // 11. MealVoteTopics + Votes (cascade)
  const oldTopics = await prisma.mealVoteTopic.findMany({
    where: { ...messFilter, createdAt: { lte: cutoffEnd } },
    select: { id: true },
  });
  if (oldTopics.length > 0) {
    await prisma.mealVote.deleteMany({
      where: { topicId: { in: oldTopics.map((t) => t.id) } },
    });
    const r11 = await prisma.mealVoteTopic.deleteMany({
      where: { id: { in: oldTopics.map((t) => t.id) } },
    });
    results.mealVoteTopics = r11.count;
  }

  // 12. Notifications
  const r12 = await prisma.notification.deleteMany({
    where: { ...messFilter, createdAt: { lte: cutoffEnd } },
  });
  results.notifications = r12.count;

  // 13. Manager Rotations
  const r13 = await prisma.managerRotation.deleteMany({
    where: {
      ...messFilter,
      OR: [
        { year: { lt: cutoffDate.getFullYear() } },
        { year: cutoffDate.getFullYear(), month: { lte: cutoffDate.getMonth() + 1 } },
      ],
    },
  });
  results.managerRotations = r13.count;

  const totalDeleted = Object.values(results).reduce((s, n) => s + n, 0);

  return NextResponse.json({
    success: true,
    cutoffDate: cutoffEnd.toISOString(),
    totalDeleted,
    details: results,
  });
}
