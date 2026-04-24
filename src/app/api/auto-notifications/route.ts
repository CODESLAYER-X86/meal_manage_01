import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import webpush from "web-push";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return POST(request);
}

// Bulk send helper
async function blastPushNotifications(userId: string, title: string, body: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { pushSubscriptions: true },
  });

  if (!user || user.pushSubscriptions.length === 0) return;

  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      "mailto:hello@example.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
  } else {
    return; // VAPID not configured
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: "/icons/icon-192.png",
    url: "/dashboard",
  });

  for (const sub of user.pushSubscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  let notificationsCreated = 0;

  try {
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

      // 1. BILL OVERDUE
      if (currentDay >= 7) {
        const billSetting = await prisma.billSetting.findUnique({
          where: { messId_month_year: { messId, month: currentMonth, year: currentYear } },
        });

        if (billSetting) {
          const rents: Record<string, number> = JSON.parse(billSetting.rents);
          const sharedUtilities = billSetting.wifi + billSetting.electricity + billSetting.gas + billSetting.cookSalary;
          const perMemberUtility = memberIds.length > 0 ? sharedUtilities / memberIds.length : 0;

          for (const memberId of memberIds) {
            const totalDue = (rents[memberId] || 0) + perMemberUtility;
            if (totalDue <= 0) continue;

            const payments = await prisma.billPayment.findMany({
              where: { memberId, messId, month: currentMonth, year: currentYear, confirmed: true },
            });
            const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

            if (totalPaid < totalDue) {
              const existingNotif = await prisma.notification.findFirst({
                where: {
                  userId: memberId,
                  messId,
                  type: "bill_overdue",
                  createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
                },
              });

              if (!existingNotif) {
                const title = "⚠️ Bill Payment Overdue";
                const message = `Your bill of ৳${totalDue.toFixed(0)} for ${getMonthName(currentMonth)} is overdue. Paid: ৳${totalPaid.toFixed(0)}.`;
                
                await prisma.notification.create({
                  data: { userId: memberId, messId, type: "bill_overdue", title, message },
                });
                
                // Blast parallel Web Push attempt (doesn't block cron if fails)
                blastPushNotifications(memberId, title, message).catch(console.error);

                notificationsCreated++;
              }
            }
          }
        }
      }

      // 2. HIGH MEAL DUE
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

      for (const memberId of memberIds) {
        const mealEntries = await prisma.mealEntry.findMany({
          where: { memberId, messId, date: { gte: startOfMonth, lte: endOfMonth } },
        });
        const totalMeals = mealEntries.reduce((sum, e) => sum + e.total, 0);

        const deposits = await prisma.deposit.findMany({
          where: { memberId, messId, date: { gte: startOfMonth, lte: endOfMonth } },
        });
        const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);

        const bazarTrips = await prisma.bazarTrip.findMany({
          where: { messId, approved: true, date: { gte: startOfMonth, lte: endOfMonth } },
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
            const title = "🍽️ High Meal Due";
            const message = `Your meal due is ৳${due.toFixed(0)} which exceeds the threshold of ৳${mess.dueThreshold}.`;
            
            await prisma.notification.create({
              data: { userId: memberId, messId, type: "meal_due_high", title, message },
            });
            
            blastPushNotifications(memberId, title, message).catch(console.error);

            notificationsCreated++;
          }
        }
      }

      // 3. BAZAR DUTY REMINDER
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = new Date(Date.UTC(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()));
      const tomorrowEnd = new Date(Date.UTC(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59));

      const tomorrowBazarDuties = await prisma.bazarDutySchedule.findMany({
        where: { messId, completed: false, date: { gte: tomorrowStart, lte: tomorrowEnd } },
      });
      for (const duty of tomorrowBazarDuties) {
        const existingNotif = await prisma.notification.findFirst({
          where: {
            userId: duty.memberId,
            messId,
            type: "bazar_duty_reminder",
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
          },
        });
        if (!existingNotif) {
          const title = "🛒 Bazar Duty Tomorrow";
          const message = `You have bazar duty tomorrow (${tomorrowStart.toISOString().split("T")[0]}). Don't forget!`;
          
          await prisma.notification.create({
            data: { userId: duty.memberId, messId, type: "bazar_duty_reminder", title, message },
          });

          blastPushNotifications(duty.memberId, title, message).catch(console.error);
          
          notificationsCreated++;
        }
      }

      // 4. WASHROOM DUTY REMINDER
      const tomorrowWashroomDuties = await prisma.washroomDutySchedule.findMany({
        where: { messId, completed: false, date: { gte: tomorrowStart, lte: tomorrowEnd } },
      });
      for (const duty of tomorrowWashroomDuties) {
        const existingNotif = await prisma.notification.findFirst({
          where: {
            userId: duty.memberId,
            messId,
            type: "washroom_duty_reminder",
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
          },
        });
        if (!existingNotif) {
          const title = "🚿 Washroom Duty Tomorrow";
          const message = `You have washroom #${duty.washroomNumber} cleaning duty tomorrow (${tomorrowStart.toISOString().split("T")[0]}).`;
          
          await prisma.notification.create({
            data: { userId: duty.memberId, messId, type: "washroom_duty_reminder", title, message },
          });

          blastPushNotifications(duty.memberId, title, message).catch(console.error);

          notificationsCreated++;
        }
      }

      // 5. MEAL STATUS REMINDER
      for (const memberId of memberIds) {
        const hasStatus = await prisma.mealStatus.findFirst({
          where: { memberId, messId, date: { gte: tomorrowStart, lte: tomorrowEnd } },
        });
        if (!hasStatus) {
          const existingNotif = await prisma.notification.findFirst({
            where: {
              userId: memberId,
              messId,
              type: "meal_status_reminder",
              createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
            },
          });
          if (!existingNotif) {
            const title = "🍽️ Set Your Meal Status";
            const message = `Don't forget to set your meal status for tomorrow!`;
            
            await prisma.notification.create({
              data: { userId: memberId, messId, type: "meal_status_reminder", title, message },
            });

            blastPushNotifications(memberId, title, message).catch(console.error);

            notificationsCreated++;
          }
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
  return ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month];
}
