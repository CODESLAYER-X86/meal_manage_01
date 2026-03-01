import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  const password = await bcryptjs.hash("123456", 10);

  // Create the 5 members from the Excel file
  const omar = await prisma.user.upsert({
    where: { email: "omar@mess.com" },
    update: {},
    create: {
      name: "Omar",
      email: "omar@mess.com",
      password,
      role: "MANAGER", // Omar is the first manager
      phone: "01700000001",
    },
  });

  const jahid = await prisma.user.upsert({
    where: { email: "jahid@mess.com" },
    update: {},
    create: {
      name: "Jahid",
      email: "jahid@mess.com",
      password,
      role: "MEMBER",
      phone: "01700000002",
    },
  });

  const zobayer = await prisma.user.upsert({
    where: { email: "zobayer@mess.com" },
    update: {},
    create: {
      name: "Zobayer",
      email: "zobayer@mess.com",
      password,
      role: "MEMBER",
      phone: "01700000003",
    },
  });

  const kabbo = await prisma.user.upsert({
    where: { email: "kabbo@mess.com" },
    update: {},
    create: {
      name: "Kabbo",
      email: "kabbo@mess.com",
      password,
      role: "MEMBER",
      phone: "01700000004",
    },
  });

  const mahbub = await prisma.user.upsert({
    where: { email: "mahbub@mess.com" },
    update: {},
    create: {
      name: "Mahbub",
      email: "mahbub@mess.com",
      password,
      role: "MEMBER",
      phone: "01700000005",
    },
  });

  // Set Omar as manager for March 2026
  await prisma.managerRotation.upsert({
    where: { month_year: { month: 3, year: 2026 } },
    update: {},
    create: {
      memberId: omar.id,
      month: 3,
      year: 2026,
    },
  });

  console.log("✅ Seeded 5 members: Omar (Manager), Jahid, Zobayer, Kabbo, Mahbub");
  console.log("🔑 Default password for all: 123456");
  console.log("📧 Login emails: omar@mess.com, jahid@mess.com, zobayer@mess.com, kabbo@mess.com, mahbub@mess.com");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
