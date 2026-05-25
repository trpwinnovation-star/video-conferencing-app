-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "createdBy" TEXT,
    "participants" TEXT,
    "duration" INTEGER,
    "fileSize" INTEGER,
    "s3Key" TEXT,
    "signedUrl" TEXT,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);
