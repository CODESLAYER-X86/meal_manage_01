import { NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, messId: true }
    });

    if (user?.role !== 'MANAGER' || !user.messId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title, message } = await req.json();

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message required' }, { status: 400 });
    }

    // Configure Web Push with VAPID keys
    webpush.setVapidDetails(
      'mailto:hello@example.com', // Replace with admin email in production if needed
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    // 1. Get all members of the mess (excluding the manager sending it, optionally)
    const members = await prisma.user.findMany({
      where: { messId: user.messId },
      include: { pushSubscriptions: true },
    });

    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/icons/icon-192.png', // The default icon for notifications
      url: '/dashboard',
    });

    // 2. Save identical In-App Notifications
    const notificationsToCreate = members.map((m) => ({
      userId: m.id,
      messId: user.messId!,
      type: 'announcement',
      title,
      message,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // 3. Blast Push Notifications to all valid subscriptions
    const allSubscriptions = members.flatMap((m) => m.pushSubscriptions);
    let successCount = 0;
    let failureCount = 0;

    const pushPromises = allSubscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        successCount++;
      } catch (err: any) {
        failureCount++;
        // 410 Gone means the subscription is no longer valid (user revoked or uninstalled)
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`Deleting dead subscription: ${sub.endpoint}`);
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error('Push error:', err);
        }
      }
    });

    await Promise.allSettled(pushPromises);

    return NextResponse.json({ 
      success: true, 
      sent: successCount, 
      failed: failureCount 
    });
  } catch (error) {
    console.error('Error sending manager notification:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
