-- CreateTable ScheduledMeeting
CREATE TABLE "ScheduledMeeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "roomId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "shareableLink" TEXT NOT NULL,
    "meetingCode" TEXT NOT NULL,
    "hostJoinedAt" TIMESTAMP(3),
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledMeeting_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScheduledMeeting_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable MeetingAttendee
CREATE TABLE "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "name" TEXT,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "invitationSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ScheduledMeeting" ("id") ON DELETE CASCADE,
    CONSTRAINT "MeetingAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL
);

-- CreateTable Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedMeetingId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledMeeting_roomId_key" ON "ScheduledMeeting"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledMeeting_shareableLink_key" ON "ScheduledMeeting"("shareableLink");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledMeeting_meetingCode_key" ON "ScheduledMeeting"("meetingCode");

-- CreateIndex
CREATE INDEX "MeetingAttendee_meetingId_idx" ON "MeetingAttendee"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingAttendee_userId_idx" ON "MeetingAttendee"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");
