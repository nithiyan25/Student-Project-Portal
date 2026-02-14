-- AlterTable
ALTER TABLE `projectscope` ADD COLUMN `isTimerRunning` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `resultsPublished` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `timerLastUpdated` DATETIME(3) NULL,
    ADD COLUMN `timerRemainingSeconds` INTEGER NULL DEFAULT 0,
    ADD COLUMN `timerTotalHours` DOUBLE NULL;

-- AlterTable
ALTER TABLE `reviewmark` ADD COLUMN `isAbsent` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `team` ADD COLUMN `submissionPhase` INTEGER NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `tempAdminTabs` TEXT NULL;

-- CreateTable
CREATE TABLE `labsession` (
    `id` VARCHAR(191) NOT NULL,
    `venueId` VARCHAR(191) NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,
    `scopeId` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,
    `title` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LabSession_facultyId_idx`(`facultyId`),
    INDEX `LabSession_scopeId_idx`(`scopeId`),
    INDEX `LabSession_startTime_idx`(`startTime`),
    INDEX `LabSession_venueId_idx`(`venueId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venue` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NULL,
    `capacity` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_sessionstudents` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_sessionstudents_AB_unique`(`A`, `B`),
    INDEX `_sessionstudents_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `labsession` ADD CONSTRAINT `LabSession_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `labsession` ADD CONSTRAINT `LabSession_scopeId_fkey` FOREIGN KEY (`scopeId`) REFERENCES `projectscope`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `labsession` ADD CONSTRAINT `LabSession_venueId_fkey` FOREIGN KEY (`venueId`) REFERENCES `venue`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_sessionstudents` ADD CONSTRAINT `_sessionstudents_A_fkey` FOREIGN KEY (`A`) REFERENCES `labsession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_sessionstudents` ADD CONSTRAINT `_sessionstudents_B_fkey` FOREIGN KEY (`B`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
