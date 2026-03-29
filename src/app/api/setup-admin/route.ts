import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// SECURITY: Only the PLATFORM_ADMIN_EMAIL can use this endpoint.
// Set PLATFORM_ADMIN_EMAIL in your Vercel env vars to your Google email.
// If no admin exists yet, the first logged-in user can claim it (one-time bootstrap).

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

    // Check if any admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { isAdmin: true },
      select: { email: true },
    });

    // If an admin already exists, only the allowed email can use this endpoint
    if (existingAdmin) {
      if (!allowedEmail) {
        return NextResponse.json(
          { error: "Admin already exists. Set PLATFORM_ADMIN_EMAIL env var to allow re-promotion." },
          { status: 403 }
        );
      }
      if (session.user.email.toLowerCase() !== allowedEmail.toLowerCase()) {
        return NextResponse.json(
          { error: "Access denied. You are not authorized to become admin." },
          { status: 403 }
        );
      }
    }

    // If PLATFORM_ADMIN_EMAIL is set, enforce it even for first-time setup
    if (allowedEmail && session.user.email.toLowerCase() !== allowedEmail.toLowerCase()) {
      return NextResponse.json(
        { error: "Access denied. Your email is not authorized." },
        { status: 403 }
      );
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
