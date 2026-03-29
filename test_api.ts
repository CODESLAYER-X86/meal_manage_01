import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function getBDTime() { ... } // won't copy BD time, just check if it throws Error.

async function run() {
  const mess = await prisma.mess.findFirst();
  if (!mess) return;
  
  const blackouts = mess.mealBlackouts ? JSON.parse(mess.mealBlackouts) : [];
  console.log("Blackouts:");
  console.log(blackouts);
  
}
run().finally(() => prisma.$disconnect());
