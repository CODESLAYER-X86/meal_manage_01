import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcryptjs from "bcryptjs";

// GET current user profile
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });

  return NextResponse.json(user);
}

// PATCH - update email or password
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "email") {
    const { newEmail, password } = body;

    if (!newEmail || !password) {
      return NextResponse.json({ error: "Email and current password required" }, { status: 400 });
    }

    // Verify current password
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const passwordMatch = await bcryptjs.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 403 });
    }

    // Check if email already taken
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { email: newEmail },
    });

    return NextResponse.json({ success: true, message: "Email updated. Please log in again with your new email." });
  }

  if (action === "password") {
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    // Verify current password
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const passwordMatch = await bcryptjs.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 403 });
    }

    const hashed = await bcryptjs.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashed },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully." });
  }

  return NextResponse.json({ error: "Invalid action. Use 'email' or 'password'" }, { status: 400 });
}
