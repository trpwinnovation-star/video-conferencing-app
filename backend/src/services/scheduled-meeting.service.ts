import { prisma } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { LivekitService } from './livekit.service';
import { createProtectedRoom, deleteRoomFromDb } from './room.service';

const livekitService = new LivekitService();

export async function createScheduledMeeting(
  title: string,
  description: string | undefined,
  hostId: string,
  scheduledTime: Date,
  durationMinutes: number = 60,
  attendeeEmails: string[] = [],
  password?: string
) {
  // Generate unique meeting code
  const meetingCode = generateMeetingCode();
  const roomId = meetingCode;

  // Create password-protected room
  const roomPassword = password || generateMeetingPassword();
  await createProtectedRoom(roomId, roomPassword, hostId);

  const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const shareableLink = `${frontendUrl}/meeting/${roomId}`;

  // Create scheduled meeting record
  const scheduledMeeting = await prisma.scheduledMeeting.create({
    data: {
      title,
      description,
      roomId,
      hostId,
      scheduledTime,
      durationMinutes,
      shareableLink,
      meetingCode,
      status: 'scheduled',
    },
  });

  // Add attendees
  for (const email of attendeeEmails) {
    await prisma.meetingAttendee.create({
      data: {
        meetingId: scheduledMeeting.id,
        email,
        name: email.split('@')[0],
      },
    });
  }

  // TODO: Send email invitations to attendees

  return scheduledMeeting;
}

export async function getScheduledMeeting(meetingId: string) {
  return await prisma.scheduledMeeting.findUnique({
    where: { id: meetingId },
    include: {
      host: {
        select: { id: true, name: true, email: true },
      },
      attendees: true,
    },
  });
}

export async function getScheduledMeetingByRoomId(roomId: string) {
  return await prisma.scheduledMeeting.findUnique({
    where: { roomId },
    include: {
      host: {
        select: { id: true, name: true, email: true },
      },
      attendees: true,
    },
  });
}

export async function getUserScheduledMeetings(userId: string) {
  return await prisma.scheduledMeeting.findMany({
    where: {
      hostId: userId,
    },
    include: {
      host: {
        select: { id: true, name: true, email: true },
      },
      attendees: true,
    },
    orderBy: {
      scheduledTime: 'desc',
    },
  });
}

export async function getUpcomingMeetings(userId: string) {
  const now = new Date();
  return await prisma.scheduledMeeting.findMany({
    where: {
      OR: [
        { hostId: userId },
        { attendees: { some: { userId } } },
      ],
      scheduledTime: {
        gte: now,
      },
    },
    include: {
      host: {
        select: { id: true, name: true, email: true },
      },
      attendees: true,
    },
    orderBy: {
      scheduledTime: 'asc',
    },
  });
}

export async function updateMeetingStatus(meetingId: string, status: string) {
  return await prisma.scheduledMeeting.update({
    where: { id: meetingId },
    data: { status },
  });
}

export async function hostJoinedMeeting(meetingId: string) {
  return await prisma.scheduledMeeting.update({
    where: { id: meetingId },
    data: {
      status: 'in_progress',
      hostJoinedAt: new Date(),
      actualStartTime: new Date(),
    },
  });
}

export async function endMeeting(meetingId: string) {
  return await prisma.scheduledMeeting.update({
    where: { id: meetingId },
    data: {
      status: 'completed',
      actualEndTime: new Date(),
    },
  });
}

export async function addMeetingAttendee(
  meetingId: string,
  email: string,
  name?: string
) {
  return await prisma.meetingAttendee.create({
    data: {
      meetingId,
      email,
      name: name || email.split('@')[0],
    },
  });
}

export async function recordAttendeeJoin(attendeeId: string) {
  return await prisma.meetingAttendee.update({
    where: { id: attendeeId },
    data: {
      joinedAt: new Date(),
    },
  });
}

export async function recordAttendeeLeft(attendeeId: string) {
  return await prisma.meetingAttendee.update({
    where: { id: attendeeId },
    data: {
      leftAt: new Date(),
    },
  });
}

// Notification functions
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  relatedMeetingId?: string
) {
  return await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      relatedMeetingId,
    },
  });
}

export async function getUserNotifications(userId: string) {
  return await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markNotificationAsRead(notificationId: string) {
  return await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  return await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

// Helper functions
function generateMeetingCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateMeetingPassword(): string {
  return uuidv4().substring(0, 12);
}

// Check for meetings that should be starting soon and send reminders
export async function checkAndSendMeetingReminders() {
  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);

  const upcomingMeetings = await prisma.scheduledMeeting.findMany({
    where: {
      scheduledTime: {
        gte: now,
        lte: fifteenMinutesFromNow,
      },
      status: 'scheduled',
    },
    include: {
      attendees: true,
    },
  });

  for (const meeting of upcomingMeetings) {
    // Notify host
    await createNotification(
      meeting.hostId,
      'meeting_reminder',
      `Meeting Starting Soon`,
      `${meeting.title} starts in 15 minutes`,
      meeting.id
    );

    // Notify attendees
    for (const attendee of meeting.attendees) {
      if (attendee.userId) {
        await createNotification(
          attendee.userId,
          'meeting_reminder',
          `Meeting Starting Soon`,
          `${meeting.title} starts in 15 minutes`,
          meeting.id
        );
      }
    }
  }
}

// Check for meetings that started but host hasn't joined
export async function checkHostNoShowAndNotify() {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

  const startedMeetings = await prisma.scheduledMeeting.findMany({
    where: {
      scheduledTime: {
        lte: fiveMinutesAgo,
      },
      status: 'scheduled',
      hostJoinedAt: null,
    },
    include: {
      attendees: true,
    },
  });

  for (const meeting of startedMeetings) {
    // Notify attendees that host hasn't joined
    for (const attendee of meeting.attendees) {
      if (attendee.userId) {
        await createNotification(
          attendee.userId,
          'host_not_joined',
          `Host Not Joined`,
          `${meeting.title} was scheduled to start, but the host hasn't joined yet`,
          meeting.id
        );
      }
    }
  }
}
