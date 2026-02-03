-- CreateTable
CREATE TABLE `project` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `maxTeamSize` INTEGER NOT NULL,
    `status` ENUM('AVAILABLE', 'REQUESTED', 'ASSIGNED', 'COMPLETED') NOT NULL DEFAULT 'AVAILABLE',
    `session` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `scopeId` VARCHAR(191) NULL,
    `techStack` TEXT NULL,
    `srs` TEXT NULL,

    INDEX `Project_category_idx`(`category`),
    INDEX `Project_scopeId_fkey`(`scopeId`),
    INDEX `Project_session_idx`(`session`),
    INDEX `Project_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projectrequest` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `requestedBy` VARCHAR(191) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,

    INDEX `ProjectRequest_projectId_idx`(`projectId`),
    INDEX `ProjectRequest_status_idx`(`status`),
    INDEX `ProjectRequest_teamId_idx`(`teamId`),
    UNIQUE INDEX `ProjectRequest_teamId_status_projectId_key`(`teamId`, `status`, `projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projectscope` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `type` VARCHAR(191) NULL,
    `requireGuide` BOOLEAN NOT NULL DEFAULT false,
    `requireSubjectExpert` BOOLEAN NOT NULL DEFAULT false,
    `numberOfPhases` INTEGER NOT NULL DEFAULT 4,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review` (
    `id` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'NOT_COMPLETED', 'IN_PROGRESS', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW', 'COMPLETED') NULL,
    `resubmittedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `resubmissionNote` TEXT NULL,
    `reviewPhase` INTEGER NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Review_facultyId_fkey`(`facultyId`),
    INDEX `Review_projectId_fkey`(`projectId`),
    INDEX `Review_teamId_fkey`(`teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviewassignment` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedBy` VARCHAR(191) NOT NULL,
    `accessStartsAt` DATETIME(3) NULL,
    `accessExpiresAt` DATETIME(3) NULL,
    `reviewPhase` INTEGER NULL,
    `mode` ENUM('ONLINE', 'OFFLINE') NOT NULL DEFAULT 'OFFLINE',

    INDEX `ReviewAssignment_facultyId_idx`(`facultyId`),
    INDEX `ReviewAssignment_projectId_idx`(`projectId`),
    UNIQUE INDEX `ReviewAssignment_projectId_facultyId_reviewPhase_key`(`projectId`, `facultyId`, `reviewPhase`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviewmark` (
    `id` VARCHAR(191) NOT NULL,
    `reviewId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `marks` INTEGER NOT NULL,
    `criterionMarks` LONGTEXT NULL,

    INDEX `ReviewMark_reviewId_fkey`(`reviewId`),
    INDEX `ReviewMark_studentId_fkey`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rubric` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `phase` INTEGER NOT NULL,
    `criteria` LONGTEXT NOT NULL,
    `totalMarks` INTEGER NOT NULL DEFAULT 100,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rubric_category_idx`(`category`),
    INDEX `rubric_phase_idx`(`phase`),
    UNIQUE INDEX `rubric_category_phase_key`(`category`, `phase`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `systemsettings` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SystemSettings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `scopeId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'NOT_COMPLETED', 'IN_PROGRESS', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `guideId` VARCHAR(191) NULL,
    `guideStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `subjectExpertId` VARCHAR(191) NULL,
    `expertStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',

    INDEX `Team_guideId_idx`(`guideId`),
    INDEX `Team_projectId_idx`(`projectId`),
    INDEX `Team_scopeId_fkey`(`scopeId`),
    INDEX `Team_status_idx`(`status`),
    INDEX `Team_subjectExpertId_idx`(`subjectExpertId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teammember` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `approved` BOOLEAN NOT NULL DEFAULT false,
    `isLeader` BOOLEAN NOT NULL DEFAULT false,

    INDEX `TeamMember_teamId_fkey`(`teamId`),
    UNIQUE INDEX `TeamMember_userId_teamId_key`(`userId`, `teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `rollNumber` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'FACULTY', 'STUDENT') NOT NULL,
    `department` VARCHAR(191) NULL,
    `year` INTEGER NULL,
    `isTemporaryAdmin` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isGuide` BOOLEAN NOT NULL DEFAULT false,
    `isSubjectExpert` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_rollNumber_key`(`rollNumber`),
    INDEX `User_department_idx`(`department`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_year_idx`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_projectscopetouser` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_projectscopetouser_AB_unique`(`A`, `B`),
    INDEX `_projectscopetouser_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `Project_scopeId_fkey` FOREIGN KEY (`scopeId`) REFERENCES `projectscope`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projectrequest` ADD CONSTRAINT `ProjectRequest_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projectrequest` ADD CONSTRAINT `ProjectRequest_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review` ADD CONSTRAINT `Review_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review` ADD CONSTRAINT `Review_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review` ADD CONSTRAINT `Review_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviewassignment` ADD CONSTRAINT `ReviewAssignment_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviewassignment` ADD CONSTRAINT `ReviewAssignment_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviewmark` ADD CONSTRAINT `ReviewMark_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `review`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviewmark` ADD CONSTRAINT `ReviewMark_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team` ADD CONSTRAINT `Team_guideId_fkey` FOREIGN KEY (`guideId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team` ADD CONSTRAINT `Team_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team` ADD CONSTRAINT `Team_scopeId_fkey` FOREIGN KEY (`scopeId`) REFERENCES `projectscope`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team` ADD CONSTRAINT `Team_subjectExpertId_fkey` FOREIGN KEY (`subjectExpertId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teammember` ADD CONSTRAINT `TeamMember_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teammember` ADD CONSTRAINT `TeamMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_projectscopetouser` ADD CONSTRAINT `_projectscopetouser_A_fkey` FOREIGN KEY (`A`) REFERENCES `projectscope`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_projectscopetouser` ADD CONSTRAINT `_projectscopetouser_B_fkey` FOREIGN KEY (`B`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
