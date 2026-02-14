const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function remediate() {
    console.log('--- Solo Team Remediation: Fixing 5 PENDING students ---');

    // Target the specific 5 teams found in the diagnostic
    const targetTeamIds = [
        "cml7sib7i013a126soiktgrt5",
        "cml7sk5zt0244126sq44p8qra",
        "cml7sk7xr0253126s7fkxgh0b",
        "cml7spx0y05jo126sl3smwm6m",
        "cml90ot2500ayv9c02ts5mk12"
    ];

    console.log(`Targeting ${targetTeamIds.length} teams...`);

    const results = await prisma.team.updateMany({
        where: {
            id: { in: targetTeamIds },
            status: 'PENDING'
        },
        data: {
            status: 'COMPLETED'
        }
    });

    console.log(`Successfully updated ${results.count} teams to COMPLETED.`);

    // Verify the results
    const remaining = await prisma.team.count({
        where: {
            id: { in: targetTeamIds },
            status: 'PENDING'
        }
    });

    if (remaining === 0) {
        console.log('Remediation successful: All 5 teams are now out of PENDING status.');
    } else {
        console.warn(`Warning: ${remaining} teams are still in PENDING status.`);
    }

    process.exit(0);
}

remediate().catch(err => {
    console.error(err);
    process.exit(1);
});
