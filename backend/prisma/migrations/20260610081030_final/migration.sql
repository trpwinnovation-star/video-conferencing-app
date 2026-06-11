/*
  Warnings:

  - A unique constraint covering the columns `[auditId,auditCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "MeetingAttendee" DROP CONSTRAINT "MeetingAttendee_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingAttendee" DROP CONSTRAINT "MeetingAttendee_userId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduledMeeting" DROP CONSTRAINT "ScheduledMeeting_hostId_fkey";

-- DropIndex
DROP INDEX "MeetingAttendee_meetingId_idx";

-- DropIndex
DROP INDEX "MeetingAttendee_userId_idx";

-- DropIndex
DROP INDEX "Notification_isRead_idx";

-- DropIndex
DROP INDEX "Notification_userId_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "auditCode" TEXT,
ADD COLUMN     "auditId" TEXT,
ADD COLUMN     "meetingDefaultPassword" TEXT NOT NULL DEFAULT '1234';

-- CreateIndex
CREATE INDEX "Recording_roomId_idx" ON "Recording"("roomId");

-- CreateIndex
CREATE INDEX "Recording_meetingId_idx" ON "Recording"("meetingId");

-- CreateIndex
CREATE INDEX "Recording_status_idx" ON "Recording"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_auditId_auditCode_key" ON "User"("auditId", "auditCode");

-- AddForeignKey
ALTER TABLE "ScheduledMeeting" ADD CONSTRAINT "ScheduledMeeting_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ScheduledMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
