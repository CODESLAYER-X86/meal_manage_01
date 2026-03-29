import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth, isAllowedAdminEmail } from "@/lib/auth";

// SECURITY: Only emails listed in PLATFORM_ADMIN_EMAIL (comma-separated) can use this endpoint.
// Set PLATFORM_ADMIN_EMAIL in your Vercel env vars to your Google email(s).
// Example: PLATFORM_ADMIN_EMAIL=admin1@gmail.com,admin2@gmail.com

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { error: "You must be logged in first. Go to /login, then come back here." },
        { status: 401 }
      );
    }

    const allowedEmail = process.env.PLATFORM_ADMIN_EMAIL;

    if (!allowedEmail) {
      return NextResponse.json(
        { error: "PLATFORM_ADMIN_EMAIL environment variable is not set. Contact the system owner." },
        { status: 403 }
      );
    }

    if (!isAllowedAdminEmail(session.user.email)) {
      return NextResponse.json(
        { error: "Access denied. Your email is not authorized to become admin." },
        { status: 403 }
      );
    }

    // Check if user is already admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (user?.isAdmin) {
      return NextResponse.json({
        success: true,
        message: `${session.user.email} is already a Platform Admin.`,
        next: "Go to /admin to access the admin panel.",
      });
    }

    // Promote the current user to admin
    await prisma.user.update({
      where: { id: session.user.id },
      data: { isAdmin: true },
    });

    return NextResponse.json({
      success: true,
      message: `${session.user.email} is now a Platform Admin.`,
      next: "Go to /admin to access the admin panel.",
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
