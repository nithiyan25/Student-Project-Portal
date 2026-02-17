const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkScope() {
    try {
        const scope = await prisma.projectscope.findUnique({
            where: { id: 'cml7sgd560000126s84y5dkpo' }
        });
        if (scope) {
            console.log('Scope Found:', scope.name);
            console.log('Results Published:', scope.resultsPublished);
        } else {
            console.log('Scope not found');
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkScope();
