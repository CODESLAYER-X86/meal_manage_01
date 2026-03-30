import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Strip channel_binding=require from the connection string.
// PgBouncer (used by Neon -pooler endpoints) does NOT support SCRAM channel
// binding, so leaving it in causes intermittent authentication failures.
function sanitizeConnectionString(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    // Fallback: simple regex removal
    return url
      .replace(/[&?]channel_binding=[^&]*/g, "")
      .replace(/\?&/, "?");
  }
}

const connectionString = sanitizeConnectionString(process.env.DATABASE_URL!);

const adapter = new PrismaNeon({ connectionString });

export const prisma =
  globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
