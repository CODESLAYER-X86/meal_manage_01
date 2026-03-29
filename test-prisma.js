const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  console.log("Testing with user:", user.id);
  
  try {
    const mess = await prisma.mess.create({
      data: {
        name: "Test Mess",
        inviteCode: "MESS-12345",
        createdById: user.id,
      },
    });
    console.log("Mess Created:", mess);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        messId: mess.id,
        role: "MANAGER",
      },
    });
    console.log("User updated.");
    
    // Cleanup
    await prisma.user.update({ where: { id: user.id }, data: { messId: null, role: "MEMBER" }});
    await prisma.mess.delete({ where: { id: mess.id } });
    
  } catch (error) {
    console.error("Error creating mess:", error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
