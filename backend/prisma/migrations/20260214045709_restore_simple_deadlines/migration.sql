-- CreateTable
CREATE TABLE `PhaseDeadline` (
    `id` VARCHAR(191) NOT NULL,
    `phase` INTEGER NOT NULL,
    `deadline` DATETIME(3) NOT NULL,
    `scopeId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PhaseDeadline_scopeId_idx`(`scopeId`),
    UNIQUE INDEX `PhaseDeadline_scopeId_phase_key`(`scopeId`, `phase`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PhaseDeadline` ADD CONSTRAINT `PhaseDeadline_scopeId_fkey` FOREIGN KEY (`scopeId`) REFERENCES `projectscope`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
