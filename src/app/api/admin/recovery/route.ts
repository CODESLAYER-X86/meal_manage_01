import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcryptjs from "bcryptjs";
import crypto from "crypto";

// POST - Admin password recovery using ADMIN_SECRET_KEY
export async function POST(request: NextRequest) {
  const { email, secret, newPassword } = await request.json();

  if (!email || !secret || !newPassword) {
    return NextResponse.json({ error: "email, secret, and newPassword are required" }, { status: 400 });
  }

  const adminSecret = process.env.ADMIN_SECRET_KEY;
  if (!adminSecret) {
    return NextResponse.json({ error: "Admin recovery is not configured" }, { status: 500 });
  }

  // Timing-safe comparison to prevent timing attacks
  const secretBuf = Buffer.from(String(secret));
  const adminBuf = Buffer.from(adminSecret);
  if (secretBuf.length !== adminBuf.length || !crypto.timingSafeEqual(secretBuf, adminBuf)) {
    return NextResponse.json({ error: "Invalid recovery key" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Admin account not found" }, { status: 404 });
  }

  // Full password validation (match signup requirements)
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!/[A-Z]/.test(newPassword)) {
    return NextResponse.json({ error: "Password must contain at least one uppercase letter" }, { status: 400 });
  }
  if (!/[a-z]/.test(newPassword)) {
    return NextResponse.json({ error: "Password must contain at least one lowercase letter" }, { status: 400 });
  }
  if (!/[0-9]/.test(newPassword)) {
    return NextResponse.json({ error: "Password must contain at least one number" }, { status: 400 });
  }

  const hashed = await bcryptjs.hash(newPassword, 12);
  await prisma.user.update({
    where: { email: email.toLowerCase().trim() },
    data: { password: hashed },
  });

  return NextResponse.json({ success: true, message: "Password has been reset." });
}

// GET - Check admin auth status
export async function GET() {
  const session = await auth();
  if (!session?.user || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return NextResponse.json({ isAdmin: false });
  }
  return NextResponse.json({ isAdmin: true, email: session.user.email, name: session.user.name });
}
