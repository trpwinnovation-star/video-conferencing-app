-- AlterTable
ALTER TABLE "Recording" ADD COLUMN     "downloadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "downloadExpiresAt" TIMESTAMP(3);
