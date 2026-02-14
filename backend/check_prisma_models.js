
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Prisma Client Models:");
        // dmmf is not always available on instance, but properties starting with lowercase usually are models
        const keys = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
        console.log(keys);

        if (prisma.labsession) console.log("prisma.labsession exists");
        if (prisma.labSession) console.log("prisma.labSession exists");
        if (prisma.LabSession) console.log("prisma.LabSession exists");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
