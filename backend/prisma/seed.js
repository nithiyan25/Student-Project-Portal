const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const email = args[0]; // Gets email from command line argument

  if (!email) {
    console.log("Please provide an email. Example: node prisma/seed.js admin@test.com");
    return;
  }

  const user = await prisma.user.upsert({
    where: { email: email },
    update: { role: 'ADMIN' },
    create: {
      email: email,
      name: 'Super Admin',
      role: 'ADMIN',
    },
  });

  console.log(`✅ Admin user upserted: ${user.email}`);
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