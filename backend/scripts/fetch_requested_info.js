require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const projectTitles = [
    "Activity Points Portal",
    "Alumni Management System",
    "CoE Automation Portal",
    "Curriculum Management Portal",
    "Department Development Plan - DDP",
    "Event Management Portal",
    "Hostel Management Portal",
    "Inventory Management",
    "IQAC - Portal",
    "Learning and Assessment Portal",
    "NEP 2020 Based Time Table Generator",
    "Placement Portal",
    "QR TeamMatch GD Platform",
    "Question bank and QP generation",
    "Scarcity-Based Multi-Entity Evaluation and Analytics Platform",
    "Simulation of PS Portal",
    "Stock and Inventory Management App",
    "Student Activity Grouping and Opportunity Platform",
    "Survey Management",
    "Task App",
    "Task Management , Accountability and Governance Platform",
    "Timetable Generation",
    "Unified Survey Based Selection, Verification, and Action-Planning System"
];

const studentRollNumbers = [
    "7376232AL137", "7376232AL135", "7376232IT277", "7376231CS186",
    "7376232IT161", "7376231CS260", "7376231CS116", "7376232CB130",
    "7376231MZ122", "7376231CS160", "7376232CB135", "7376231CD124",
    "7376231CD141", "7376242AD510", "7376232CT104", "7376231SE117",
    "7376231CS142", "7376231MZ116", "7376241MZ505", "7376231EC317",
    "7376231CS323", "7376231CS212", "7376232AL203", "7376232AL215",
    "7376232AL175", "7376242AD502", "7376232IT110", "7376232IT186",
    "7376232AL103", "7376231SE129", "7376231EI117"
];

async function main() {
    console.log('--- PROJECT DETAILS ---');
    const projects = await prisma.project.findMany({
        where: {
            title: { in: projectTitles }
        },
        select: {
            title: true,
            description: true,
            techStack: true,
            category: true,
            maxTeamSize: true,
            status: true
        }
    });

    projects.forEach(p => {
        console.log(`Title: ${p.title}`);
        console.log(`Category: ${p.category}`);
        console.log(`Status: ${p.status}`);
        console.log(`Max Team Size: ${p.maxTeamSize}`);
        console.log(`Tech Stack: ${p.techStack || 'N/A'}`);
        console.log(`Description: ${p.description || 'N/A'}`);
        console.log('------------------------');
    });

    console.log('\n--- STUDENT EMAILS ---');
    const students = await prisma.user.findMany({
        where: {
            rollNumber: { in: studentRollNumbers }
        },
        select: {
            name: true,
            rollNumber: true,
            email: true
        }
    });

    studentRollNumbers.forEach(roll => {
        const student = students.find(s => s.rollNumber === roll);
        if (student) {
            console.log(`${student.name} (${student.rollNumber}): ${student.email}`);
        } else {
            console.log(`Roll Number NOT FOUND: ${roll}`);
        }
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
