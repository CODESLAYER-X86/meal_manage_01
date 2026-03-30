import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Strip channel_binding param which is incompatible with PgBouncer (Neon pooler)
function cleanUrl(url: string): string {
  return url
    .replace(/([&?])channel_binding=[^&]*/g, (_, prefix) => prefix === "?" ? "?" : "")
    .replace(/\?&/, "?")
    .replace(/\?$/, "");
}

const connectionString = cleanUrl(process.env.DATABASE_URL!);

const adapter = new PrismaNeon({ connectionString });

export const prisma =
  globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
