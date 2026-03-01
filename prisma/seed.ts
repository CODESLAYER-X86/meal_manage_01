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
      role: "MANAGER",
      phone: "01700000001",
    },
  });

  // Create the default mess
  const mess = await prisma.mess.upsert({
    where: { inviteCode: "MESS-DEFAULT" },
    update: {},
    create: {
      id: "mess_default",
      name: "42/A Mirpur Mess",
      inviteCode: "MESS-DEFAULT",
      createdById: omar.id,
    },
  });

  // Update Omar to be in the mess
  await prisma.user.update({
    where: { id: omar.id },
    data: { messId: mess.id },
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
      messId: mess.id,
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
      messId: mess.id,
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
      messId: mess.id,
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
      messId: mess.id,
    },
  });

  // Set Omar as manager for March 2026
  await prisma.managerRotation.upsert({
    where: { month_year_messId: { month: 3, year: 2026, messId: mess.id } },
    update: {},
    create: {
      memberId: omar.id,
      messId: mess.id,
      month: 3,
      year: 2026,
    },
  });

  // Suppress unused variable warnings
  void jahid; void zobayer; void kabbo; void mahbub;

  console.log("✅ Seeded 5 members: Omar (Manager), Jahid, Zobayer, Kabbo, Mahbub");
  console.log("🏠 Default mess: 42/A Mirpur Mess (invite: MESS-DEFAULT)");
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
