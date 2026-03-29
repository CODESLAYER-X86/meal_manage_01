import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcryptjs from "bcryptjs";

export async function GET() {
  try {
    const password = await bcryptjs.hash("123456", 10);
    
    // Create the super admin user programmatically
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
      message: "Successfully created the super admin! You can now log in.",
      admin: { email: admin.email, name: admin.name }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
