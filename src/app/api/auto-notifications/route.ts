import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST - Run auto-notifications (called by cron or manual trigger)
// Generates notifications for: overdue bills, high meal dues, upcoming washroom duties, bazar duties tomorrow
export async function POST(request: Request) {
  // Verify cron secret or admin
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  let notificationsCreated = 0;

  try {
    // Get all active messes
    const messes = await prisma.mess.findMany({
      select: {
        id: true,
        dueThreshold: true,
        members: {
          where: { isActive: true },
          select: { id: true, name: true },
        },
      },
    });

    for (const mess of messes) {
      const messId = mess.id;
      const memberIds = mess.members.map((m) => m.id);

      // 1. BILL OVERDUE: Check if bills are set and any member hasn't paid after 7th of month
      if (currentDay >= 7) {
        const billSetting = await prisma.billSetting.findUnique({
          where: { messId_month_year: { messId, month: currentMonth, year: currentYear } },
        });

        if (billSetting) {
          const rents: Record<string, number> = JSON.parse(billSetting.rents);
          const sharedUtilities =
            billSetting.wifi + billSetting.electricity + billSetting.gas + billSetting.cookSalary;
          const perMemberUtility = memberIds.length > 0 ? sharedUtilities / memberIds.length : 0;

          for (const memberId of memberIds) {
            const totalDue = (rents[memberId] || 0) + perMemberUtility;
            if (totalDue <= 0) continue;

            // Check confirmed payments
            const payments = await prisma.billPayment.findMany({
              where: { memberId, messId, month: currentMonth, year: currentYear, confirmed: true },
            });
            const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

            if (totalPaid < totalDue) {
              // Check if we already sent this notification today
              const existingNotif = await prisma.notification.findFirst({
                where: {
                  userId: memberId,
                  messId,
                  type: "bill_overdue",
                  createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
                },
              });

              if (!existingNotif) {
                await prisma.notification.create({
                  data: {
                    userId: memberId,
                    messId,
                    type: "bill_overdue",
                    title: "⚠️ Bill Payment Overdue",
                    message: `Your bill of ৳${totalDue.toFixed(0)} for ${getMonthName(currentMonth)} is overdue. Paid: ৳${totalPaid.toFixed(0)}.`,
                  },
                });
                notificationsCreated++;
              }
            }
          }
        }
      }

      // 2. HIGH MEAL DUE: Check if anyone's meal due exceeds threshold
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

      for (const memberId of memberIds) {
        // Calculate meal total for this month
        const mealEntries = await prisma.mealEntry.findMany({
          where: { memberId, messId, date: { gte: startOfMonth, lte: endOfMonth } },
        });
        const totalMeals = mealEntries.reduce((sum, e) => sum + e.total, 0);

        // Calculate deposits this month
        const deposits = await prisma.deposit.findMany({
          where: { memberId, messId, date: { gte: startOfMonth, lte: endOfMonth } },
        });
        const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);

        // Get all bazar expenses for the mess this month (to compute meal rate)
        const bazarTrips = await prisma.bazarTrip.findMany({
          where: { messId, date: { gte: startOfMonth, lte: endOfMonth } },
        });
        const totalBazar = bazarTrips.reduce((sum, t) => sum + t.totalCost, 0);

        const allMeals = await prisma.mealEntry.findMany({
          where: { messId, date: { gte: startOfMonth, lte: endOfMonth } },
        });
        const totalAllMeals = allMeals.reduce((sum, e) => sum + e.total, 0);
        const mealRate = totalAllMeals > 0 ? totalBazar / totalAllMeals : 0;
        const mealCost = totalMeals * mealRate;
        const due = mealCost - totalDeposits;

        if (due > mess.dueThreshold) {
          const existingNotif = await prisma.notification.findFirst({
            where: {
              userId: memberId,
              messId,
              type: "meal_due_high",
              createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
            },
          });

          if (!existingNotif) {
            await prisma.notification.create({
              data: {
                userId: memberId,
                messId,
                type: "meal_due_high",
                title: "🍽️ High Meal Due",
                message: `Your meal due is ৳${due.toFixed(0)} which exceeds the threshold of ৳${mess.dueThreshold}.`,
              },
            });
            notificationsCreated++;
          }
        }
      }

      // 3. WASHROOM DUTY REMINDER: 3 days before a pending duty
      const threeDaysLater = new Date(now);
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      const threeDaysLaterEnd = new Date(threeDaysLater);
      threeDaysLaterEnd.setHours(23, 59, 59);

      const upcomingWashroom = await prisma.washroomCleaning.findMany({
        where: {
          messId,
          status: "PENDING",
          date: {
            gte: new Date(threeDaysLater.getFullYear(), threeDaysLater.getMonth(), threeDaysLater.getDate()),
            lte: threeDaysLaterEnd,
          },
        },
      });

      for (const duty of upcomingWashroom) {
        const existingNotif = await prisma.notification.findFirst({
          where: {
            userId: duty.memberId,
            messId,
            type: "washroom_reminder",
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
          },
        });

        if (!existingNotif) {
          await prisma.notification.create({
            data: {
              userId: duty.memberId,
              messId,
              type: "washroom_reminder",
              title: "🚿 Washroom Duty Coming Up",
              message: `You have washroom cleaning duty on ${duty.date.toISOString().split("T")[0]} (Washroom #${duty.washroomNumber}).`,
            },
          });
          notificationsCreated++;
        }
      }

      // 4. BAZAR DUTY TOMORROW
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setHours(23, 59, 59);

      const tomorrowBazar = await prisma.bazarDuty.findMany({
        where: {
          messId,
          status: "PENDING",
          date: { gte: tomorrowStart, lte: tomorrowEnd },
        },
      });

      for (const duty of tomorrowBazar) {
        const existingNotif = await prisma.notification.findFirst({
          where: {
            userId: duty.memberId,
            messId,
            type: "bazar_reminder",
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
          },
        });

        if (!existingNotif) {
          await prisma.notification.create({
            data: {
              userId: duty.memberId,
              messId,
              type: "bazar_reminder",
              title: "🛒 Bazar Duty Tomorrow",
              message: `You have bazar duty tomorrow (${tomorrow.toISOString().split("T")[0]}).`,
            },
          });
          notificationsCreated++;
        }
      }
    }

    return NextResponse.json({ success: true, notificationsCreated });
  } catch (error) {
    console.error("Auto-notification error:", error);
    return NextResponse.json({ error: "Failed to generate notifications" }, { status: 500 });
  }
}

function getMonthName(month: number): string {
  return [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][month];
}
