import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import bcryptjs from "bcryptjs";

// POST /api/auth/reset-password
// Body: { token, newPassword }
export async function POST(request: NextRequest) {
    try {
        const { token, newPassword } = await request.json();

        if (!token || !newPassword) {
            return NextResponse.json({ error: "Token and new password are required" }, { status: 400 });
        }

        // Password strength validation
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

        const record = await prisma.verificationToken.findUnique({ where: { token } });

        if (!record || record.type !== "PASSWORD_RESET") {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
        }
        if (record.used) {
            return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 });
        }
        if (record.expiresAt < new Date()) {
            return NextResponse.json({ error: "This link has expired. Request a new reset link." }, { status: 400 });
        }

        const hashed = await bcryptjs.hash(newPassword, 12);

        // Mark token used + update password + ensure email is verified (they proved email access)
        await prisma.$transaction([
            prisma.verificationToken.update({ where: { token }, data: { used: true } }),
            prisma.user.update({
                where: { id: record.userId },
                data: { password: hashed, emailVerified: true },
            }),
        ]);

        return NextResponse.json({ success: true, message: "Password reset successfully. You can now log in." });
    } catch (error) {
        console.error("Reset password error:", error);
        return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
}
