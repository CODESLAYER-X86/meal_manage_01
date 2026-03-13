import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/auth/verify-email
// Body: { token }
export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();
        if (!token) {
            return NextResponse.json({ error: "Token is required" }, { status: 400 });
        }

        const record = await prisma.verificationToken.findUnique({ where: { token } });

        if (!record || record.type !== "EMAIL_VERIFY") {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
        }
        if (record.used) {
            return NextResponse.json({ error: "This link has already been used" }, { status: 400 });
        }
        if (record.expiresAt < new Date()) {
            return NextResponse.json({ error: "This link has expired. Request a new one." }, { status: 400 });
        }

        // Mark token as used + verify user in one transaction
        await prisma.$transaction([
            prisma.verificationToken.update({ where: { token }, data: { used: true } }),
            prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
        ]);

        return NextResponse.json({ success: true, message: "Email verified! You can now log in." });
    } catch (error) {
        console.error("Verify email error:", error);
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
}
