import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcryptjs from "bcryptjs";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();

    // If the user is already logged in (e.g., via Google), instantly upgrade them!
    if (session?.user?.id) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { isAdmin: true },
      });
      return NextResponse.json({
        success: true,
        message: `Successfully upgraded ${session.user.email} to Super Admin!`,
        user: session.user.email
      });
    }

    // Fallback if they are NOT logged in: Create the standard admin
    const password = await bcryptjs.hash("123456", 10);
    const admin = await prisma.user.upsert({
      where: { email: "admin@messmeal.app" },
      update: {},
      create: {
        name: "Super Admin",
        email: "admin@messmeal.app",
        password,
        role: "MEMBER",
        isAdmin: true,
        isActive: true,
        emailVerified: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Successfully created the super admin! You can now log into admin@messmeal.app.",
      admin: { email: admin.email, name: admin.name }
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
