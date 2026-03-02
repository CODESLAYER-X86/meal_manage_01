import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET - Promote a user to admin using a secret env key
// Usage: GET /api/admin/setup?email=user@example.com&secret=YOUR_ADMIN_SECRET_KEY
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const secret = searchParams.get("secret");

  const adminSecret = process.env.ADMIN_SECRET_KEY;

  if (!adminSecret) {
    return NextResponse.json(
      { error: "Admin setup is not configured. Set ADMIN_SECRET_KEY env variable." },
      { status: 500 }
    );
  }

  if (!email || !secret) {
    return NextResponse.json(
      { error: "email and secret query parameters are required" },
      { status: 400 }
    );
  }

  if (secret !== adminSecret) {
    return NextResponse.json({ error: "Invalid secret key" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.isAdmin) {
    return NextResponse.json({ message: "User is already an admin" });
  }

  await prisma.user.update({
    where: { email },
    data: { isAdmin: true },
  });

  return NextResponse.json({
    success: true,
    message: `${user.name} (${user.email}) has been promoted to admin.`,
  });
}
