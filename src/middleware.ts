import { NextRequest, NextResponse } from "next/server";

// ===== In-memory rate limiter (per-instance, resets on cold start) =====
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    // Cleanup old entries periodically (every 100 checks)
    if (Math.random() < 0.01) {
        for (const [key, val] of rateLimitMap) {
            if (val.resetAt < now) rateLimitMap.delete(key);
        }
    }

    if (!entry || entry.resetAt < now) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (entry.count >= limit) return false;
    entry.count++;
    return true;
}

function getIP(request: NextRequest): string {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown"
    );
}

// Rate limit configs: [max requests, window in ms]
const RATE_LIMITS: Record<string, [number, number]> = {
    "/api/auth/signup": [5, 15 * 60 * 1000],  // 5 per 15min
    "/api/auth/forgot-password": [3, 15 * 60 * 1000],  // 3 per 15min
    "/api/auth/reset-password": [5, 15 * 60 * 1000],  // 5 per 15min
    "/api/auth/resend-verification": [3, 15 * 60 * 1000], // 3 per 15min
    "/api/admin/recovery": [3, 60 * 60 * 1000],  // 3 per hour
};

const GENERAL_API_LIMIT = 60;   // 60 requests per minute for all other API routes
const GENERAL_API_WINDOW = 60 * 1000;

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const ip = getIP(request);

    // --- Rate limiting for sensitive endpoints ---
    if (request.method === "POST" || request.method === "PATCH" || request.method === "DELETE") {
        const sensitiveConfig = RATE_LIMITS[pathname];
        if (sensitiveConfig) {
            const [limit, window] = sensitiveConfig;
            const key = `${ip}:${pathname}`;
            if (!rateLimit(key, limit, window)) {
                console.warn(`[SECURITY] Rate limit hit: ${ip} on ${pathname} at ${new Date().toISOString()}`);
                return NextResponse.json(
                    { error: "Too many requests. Please try again later." },
                    { status: 429 }
                );
            }
        }
    }

    // --- General API rate limiting ---
    if (pathname.startsWith("/api/")) {
        const key = `${ip}:api-general`;
        if (!rateLimit(key, GENERAL_API_LIMIT, GENERAL_API_WINDOW)) {
            console.warn(`[SECURITY] General rate limit hit: ${ip} at ${new Date().toISOString()}`);
            return NextResponse.json(
                { error: "Rate limit exceeded. Please slow down." },
                { status: 429 }
            );
        }
    }

    // --- CSRF protection: verify Origin on mutating requests ---
    if (
        pathname.startsWith("/api/") &&
        !pathname.startsWith("/api/auth/") && // Auth routes handle their own
        (request.method === "POST" || request.method === "PATCH" || request.method === "DELETE")
    ) {
        const origin = request.headers.get("origin");
        const host = request.headers.get("host");
        if (origin && host && !origin.includes(host)) {
            console.warn(`[SECURITY] CSRF blocked: ${ip} origin=${origin} host=${host} path=${pathname}`);
            return NextResponse.json(
                { error: "Forbidden: cross-origin request" },
                { status: 403 }
            );
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/api/:path*"],
};
