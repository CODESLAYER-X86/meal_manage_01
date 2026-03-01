import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcryptjs from "bcryptjs";

// GET all members
export async function GET() {
  const members = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      joinDate: true,
      leaveDate: true,
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(members);
}

// POST - add new member (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, phone, password } = body;

  const hashedPassword = await bcryptjs.hash(password || "123456", 10);

  const member = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
      role: "MEMBER",
    },
  });

  return NextResponse.json({ id: member.id, name: member.name });
}
