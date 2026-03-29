const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const mess = await prisma.mess.findFirst();
  console.log("Auto Meal entry:", mess?.autoMealEntry);
  console.log("Blackouts:", mess?.mealBlackouts);
}
run().finally(() => prisma.$disconnect());
