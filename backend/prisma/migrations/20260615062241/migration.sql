/*
  Warnings:

  - A unique constraint covering the columns `[auditVisit,auditCode]` on the table `ScheduledMeeting` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ScheduledMeeting_auditVisit_auditCode_key" ON "ScheduledMeeting"("auditVisit", "auditCode");
