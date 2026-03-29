const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const mess = await prisma.mess.findFirst();
  console.log("Mess records:", mess);
}
run().finally(() => prisma.$disconnect());
