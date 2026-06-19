import { prisma } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { LivekitService } from './livekit.service';
import { createProtectedRoom, deleteRoomFromDb } from './room.service';
import { sendMeetingInviteEmail } from './email.service';

const livekitService = new LivekitService();

export async function createScheduledMeeting(
  title: string,
  description: string | undefined,
  hostId: string,
  scheduledTime: Date,
  durationMinutes: number = 60,
  attendeeEmails: string[] = [],
  password?: string,
  auditVisit: string | null = null,
  auditCode: string | null = null,
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
      auditVisit,
      auditCode
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

  // Send email invitations to attendees
  if (attendeeEmails.length > 0) {
    const host = await prisma.user.findUnique({ where: { id: hostId } });
    const hostName = host ? host.name : 'A member';

    for (const email of attendeeEmails) {
      // Send asynchronously so we don't block the API response
      sendMeetingInviteEmail(
        email,
        hostName,
        title,
        description || '',
        roomPassword,
        scheduledTime,
        shareableLink
      ).catch(console.error);
    }
  }

  return scheduledMeeting;
}

export async function autoExpireMeetings() {
  const now = new Date();
  try {
    const expiredScheduled = await prisma.scheduledMeeting.findMany({
      where: {
        status: { in: ['scheduled', 'in_progress'] },
      }
    });

    for (const meeting of expiredScheduled) {
      const start = new Date(meeting.scheduledTime);
      const end = new Date(start.getTime() + meeting.durationMinutes * 60000);
      if (now > end) {
        await prisma.scheduledMeeting.update({
          where: { id: meeting.id },
          data: { status: 'completed', actualEndTime: end }
        });
        try {
          await livekitService.deleteRoom(meeting.roomId);
        } catch {}
        try {
          await deleteRoomFromDb(meeting.roomId);
        } catch {}
      }
    }
  } catch (error) {
    console.error('Error auto-expiring meetings:', error);
  }
}

export async function getScheduledMeeting(meetingId: string) {
  await autoExpireMeetings();
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
  await autoExpireMeetings();
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
  await autoExpireMeetings();
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
  await autoExpireMeetings();
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

/**
 * Update scheduled meeting details
 */
export async function updateScheduledMeeting(
  meetingId: string,
  data: {
    title?: string;
    description?: string;
    scheduledTime?: Date | string;
    durationMinutes?: number;
    password?: string;
    attendeeEmails?: string[];
  }
) {
  const meeting = await prisma.scheduledMeeting.findUnique({
    where: { id: meetingId },
  });

  if (!meeting) {
    throw new Error('Meeting not found');
  }

  // Update ScheduledMeeting record
  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.scheduledTime !== undefined) updateData.scheduledTime = new Date(data.scheduledTime);
  if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;

  const updatedMeeting = await prisma.scheduledMeeting.update({
    where: { id: meetingId },
    data: updateData,
  });

  // Update password if provided
  if (data.password) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    await prisma.room.update({
      where: { roomId: meeting.roomId },
      data: { passwordHash },
    });
  }

  // Update attendees list if provided
  if (data.attendeeEmails !== undefined) {
    // Delete existing attendees
    await prisma.meetingAttendee.deleteMany({
      where: { meetingId },
    });

    // Create new attendees
    for (const email of data.attendeeEmails) {
      await prisma.meetingAttendee.create({
        data: {
          meetingId,
          email,
          name: email.split('@')[0],
        },
      });
    }
  }

  return updatedMeeting;
}

// In-memory map to track when hosts disconnect from in-progress meetings
const hostDisconnectionTimes = new Map<string, number>();

/**
 * Background worker to auto-complete expired or abandoned meetings
 */
export function startScheduledMeetingAutoCompleter() {
  console.log('[Auto-Completer] Starting Scheduled Meeting Auto-Completer loop (every 1 minute)...');

  setInterval(async () => {
    try {
      const now = new Date();

      // Fetch all scheduled or in-progress meetings
      const activeMeetings = await prisma.scheduledMeeting.findMany({
        where: {
          status: { in: ['scheduled', 'in_progress'] },
        },
      });

      for (const meeting of activeMeetings) {
        const scheduledStart = new Date(meeting.scheduledTime);
        const scheduledEnd = new Date(scheduledStart.getTime() + (meeting.durationMinutes * 60 * 1000));

        let shouldEnd = false;
        let reason = '';

        // Condition 1: If we are past scheduled end time (the duration has expired)
        if (now.getTime() > scheduledEnd.getTime()) {
          shouldEnd = true;
          reason = 'Meeting expired (scheduled duration ended)';
        }

        // Condition 2: If the meeting is in progress, check if the host has left
        if (!shouldEnd && meeting.status === 'in_progress') {
          try {
            const participants = await livekitService.listParticipants(meeting.roomId);
            const hostPresent = participants.some((p: any) => {
              try {
                const meta = JSON.parse(p.metadata || '{}');
                return meta.isHost === true;
              } catch {
                return false;
              }
            });

            if (!hostPresent) {
              const disconnectedSince = hostDisconnectionTimes.get(meeting.id);
              if (disconnectedSince) {
                // If the host has been disconnected for more than 1 minute (grace period)
                if (now.getTime() - disconnectedSince > 60000) {
                  shouldEnd = true;
                  reason = 'Meeting expired (host disconnected for more than 1 minute)';
                }
              } else {
                // Mark the host as disconnected now
                hostDisconnectionTimes.set(meeting.id, now.getTime());
              }
            } else {
              // Host is present, reset their disconnection timer if they had one
              hostDisconnectionTimes.delete(meeting.id);
            }
          } catch (lkErr: any) {
            // Room not found or connection issue - assume abandoned
            shouldEnd = true;
            reason = 'Meeting expired (LiveKit room not found or empty)';
          }
        }

        if (shouldEnd) {
          console.log(`[Auto-Completer] Ending meeting "${meeting.title}": ${reason}`);
          try {
            await livekitService.deleteRoom(meeting.roomId);
          } catch (lkErr: any) {
            // Ignore if room already deleted or not found
          }
          await deleteRoomFromDb(meeting.roomId);
          // deleteRoomFromDb already marks the ScheduledMeeting as completed in the database.
          hostDisconnectionTimes.delete(meeting.id);
        }
      }
    } catch (error: any) {
      console.error('[Auto-Completer] Error in background worker loop:', error.message);
    }
  }, 1 * 60 * 1000); // Check every 1 minute
}

