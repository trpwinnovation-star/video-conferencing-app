import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/db';


import {
  createScheduledMeeting,
  getScheduledMeeting,
  getScheduledMeetingByRoomId,
  getUserScheduledMeetings,
  getUpcomingMeetings,
  hostJoinedMeeting,
  endMeeting,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  updateScheduledMeeting,
} from '../services/scheduled-meeting.service';
import { LivekitService } from '../services/livekit.service';
import { createProtectedRoom, deleteRoomFromDb } from '../services/room.service';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const livekitService = new LivekitService();

// Get current user ID from token
const getUserIdFromToken = (req: Request): string | null => {
  let token = req.cookies?.token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    return decoded.id;
  } catch {
    return null;
  }
};

// Create scheduled meeting
export const scheduleNewMeeting = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { title, description, scheduledTime, durationMinutes, attendeeEmails, password } = req.body;

    if (!title || !scheduledTime) {
      return res.status(400).json({ error: 'Title and scheduledTime are required' });
    }

    const scheduledDate = new Date(scheduledTime);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    const meeting = await createScheduledMeeting(
      title,
      description,
      userId,
      scheduledDate,
      durationMinutes || 60,
      attendeeEmails || [],
      password
    );

    return res.status(201).json({
      meeting,
      shareableLink: meeting.shareableLink,
      meetingCode: meeting.meetingCode,
    });
  } catch (error: any) {
    console.error('Schedule meeting error:', error);
    return res.status(500).json({ error: error.message || 'Failed to schedule meeting' });
  }
};

// Get scheduled meeting details
export const getScheduledMeetingDetails = async (req: Request, res: Response) => {
  try {
    const meetingId = String(req.params.meetingId);

    // if (!meetingId) {
    //   return res.status(400).json({
    //     error: "Meeting ID is required",
    //   });
    // }

    const meeting = await getScheduledMeeting(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    return res.json(meeting);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch meeting' });
  }
};

// Get user's scheduled meetings
export const getUserMeetings = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const meetings = await getUserScheduledMeetings(userId);
    return res.json({ meetings });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch meetings' });
  }
};

// Get upcoming meetings (both hosted and attending)
export const getUpcomingUserMeetings = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const meetings = await getUpcomingMeetings(userId);
    return res.json({ meetings });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch meetings' });
  }
};

// Host joins meeting
export const joinScheduledMeeting = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const meetingId = String(req.params.meetingId);

    const meeting = await getScheduledMeeting(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.hostId !== userId) {
      return res.status(403).json({ error: 'Only host can join scheduled meeting' });
    }

    await hostJoinedMeeting(meetingId);

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const livekitToken = await livekitService.generateToken(
      meeting.roomId,
      user?.name || 'Host',
      true
    );

    return res.json({
      token: livekitToken,
      roomId: meeting.roomId,
      meeting,
    });
  } catch (error: any) {
    console.error('Join meeting error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to join meeting',
    });
  }
};

// End scheduled meeting
export const endScheduledMeeting = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const meetingId = String(req.params.meetingId);

    const meeting = await getScheduledMeeting(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.hostId !== userId) {
      return res.status(403).json({ error: 'Only host can end meeting' });
    }

    try {
      await livekitService.deleteRoom(meeting.roomId);
    } catch (livekitError: any) {
      console.warn('LiveKit room delete warning in scheduled meeting:', livekitError.message);
    }

    await endMeeting(meetingId);
    await deleteRoomFromDb(meeting.roomId);

    return res.json({
      message: 'Meeting ended successfully',
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Failed to end meeting',
    });
  }
};

// Get notifications for user
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const notifications = await getUserNotifications(userId);
    const unreadCount = notifications.filter(n => !n.isRead).length;

    return res.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  }
};

// Mark notification as read
export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const notificationId = String(req.params.notificationId);

    await markNotificationAsRead(notificationId);

    return res.json({
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Failed to update notification',
    });
  }
};

// Mark all notifications as read
export const markAllNotificationsRead = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await markAllNotificationsAsRead(userId);

    return res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update notifications' });
  }
};

// Get scheduled meeting by room ID (for joining via link)
export const getMeetingByCode = async (req: Request, res: Response) => {
  try {
    const roomId = String(req.params.roomId);

    const meeting = await getScheduledMeetingByRoomId(roomId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    return res.json({
      id: meeting.id,
      title: meeting.title,
      description: meeting.description,
      scheduledTime: meeting.scheduledTime,
      host: meeting.host,
      status: meeting.status,
      hostJoinedAt: meeting.hostJoinedAt,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Failed to fetch meeting',
    });
  }
};

// Generate LiveKit token for attendee to join
export const getAttendeeToken = async (req: Request, res: Response) => {
  try {
    const roomId = String(req.params.roomId);
    const { participantName } = req.body;

    if (!participantName) {
      return res.status(400).json({
        error: 'participantName is required',
      });
    }

    const meeting = await getScheduledMeetingByRoomId(roomId);

    if (!meeting) {
      return res.status(404).json({
        error: 'Meeting not found',
      });
    }

    const now = new Date();
    const meetingStart = new Date(meeting.scheduledTime);
    const fifteenMinsBefore = new Date(meetingStart.getTime() - 15 * 60 * 1000);

    if (meeting.status === 'cancelled') {
      return res.status(403).json({
        error: 'This meeting has been cancelled',
      });
    }

    if (meeting.status === 'completed') {
      return res.status(403).json({
        error: 'This meeting has already ended',
      });
    }

    if (now < fifteenMinsBefore) {
      return res.status(403).json({
        error: 'Meeting has not started yet. You can join 15 minutes before the scheduled time.',
        startsAt: meeting.scheduledTime,
      });
    }

    const livekitToken = await livekitService.generateToken(
      meeting.roomId,
      participantName,
      false
    );

    return res.json({
      token: livekitToken,
      roomId: meeting.roomId,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        host: meeting.host,
        status: meeting.status,
      },
    });
  } catch (error: any) {
    console.error('Get attendee token error:', error);
    const message = error?.message || 'Failed to get token';
    const status = message.includes('Room is full') ? 403 : 500;
    return res.status(status).json({
      error: message,
    });
  }
};

export const getAuditMeetStatus = async (req: Request, res: Response) => {
  try {
    console.log("Api hited for Betel Audit for Meet")
    console.log(req.body)
    const { token, RefVisit } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    const { _Id, _TenantKey, _Email, _Name } = jwt.verify(token, JWT_SECRET) as { _Id: number, _TenantKey: string, _Email: string, _Name: string }
    console.log("Decoded token:", _Id, _TenantKey, _Email, _Name);

    const User = await prisma.user.findFirst({
      where: {
        email: _Email,
        auditId: _Id.toString(),
        auditCode: _TenantKey
      },
    })

    if (!User) {
      console.log("user not found")
      return res.status(400).json({
        success: false,
        message: "user not exist"
      })
    }
    console.log("user found")

    const meeting = await prisma.scheduledMeeting.findFirst({
      where: {
        hostId: User.id,
        auditVisit: RefVisit.toString(),
        auditCode: _TenantKey
      }
    })

    if (!meeting) {
      console.log("meeting not found")
      return res.status(400).json({
        success: false,
        message: "Meeting not scheduled"
      })
    }
    console.log("Meeting found", meeting)

    return res.json({ success: true, data: meeting, message: "Meeting found for the audit" });
  } catch (error: any) {
    console.log(error)
    return res.status(500).json({ error: error.message || 'Failed to fetch meeting' });
  }
};

export const updateMeeting = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const meetingId = String(req.params.meetingId);
    const meeting = await getScheduledMeeting(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.hostId !== userId) {
      return res.status(403).json({ error: 'Only the host can edit this meeting' });
    }

    const { title, description, scheduledTime, durationMinutes, password, attendeeEmails } = req.body;

    const updated = await updateScheduledMeeting(meetingId, {
      title,
      description,
      scheduledTime,
      durationMinutes,
      password,
      attendeeEmails,
    });

    return res.json({ meeting: updated });
  } catch (error: any) {
    console.error('Update meeting error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update meeting' });
  }
};

export const scheduleAuditMeeting = async (req: Request, res: Response) => {
  try {

    const { title, description, scheduledTime, auditId, token } = req.body

    if (!title || !description || !scheduledTime || !auditId || !token) {
      return res.status(400).json({
        success: false,
        message: "Missing required feilds"
      })
    }

    const { _Id, _TenantKey, _Email, _Name } = jwt.verify(token, JWT_SECRET) as { _Id: number, _TenantKey: string, _Email: string, _Name: string }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: _Email,
        auditId: _Id.toString(),
        auditCode: _TenantKey
      },
    })

    if (!existingUser) {
      return res.status(400).json({
        success: false,
        message: "Invalid Authorization of BetelAudit. Kindly Create Your account frist"
      })
    }

    console.log("user found", existingUser)


    const scheduledDate = new Date(scheduledTime);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    const meeting = await createScheduledMeeting(
      title,
      description,
      existingUser.id,
      scheduledDate,
      60,
      [],
      existingUser.meetingDefaultPassword,
      auditId.toString(),
      existingUser.auditCode
    );

    return res.status(201).json({
      meeting,
      shareableLink: meeting.shareableLink,
      meetingCode: meeting.meetingCode,
    });
  } catch (error: any) {
    console.error('Schedule meeting error:', error);
    return res.status(500).json({ error: error.message || 'Failed to schedule meeting' });
  }
};

export const updateScheduleAuditMeeting = async (req: Request, res: Response) => {
  try {

    const { title, description, scheduledTime, meetingId, token } = req.body

    if (!title || !description || !scheduledTime || !meetingId || !token) {
      return res.status(400).json({
        success: false,
        message: "Missing required feilds"
      })
    }

    const { _Id, _TenantKey, _Email, _Name } = jwt.verify(token, JWT_SECRET) as { _Id: number, _TenantKey: string, _Email: string, _Name: string }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: _Email,
        auditId: _Id.toString(),
        auditCode: _TenantKey
      },
    })

    if (!existingUser) {
      return res.status(400).json({
        success: false,
        message: "Invalid Authorization of BetelAudit. Kindly Create Your account frist"
      })
    }

    console.log("user found", existingUser)


    const scheduledDate = new Date(scheduledTime);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    const payload = {
      title: title,
      description: description,
      scheduledTime: scheduledDate

    }
    const meeting = await updateScheduledMeeting(
      meetingId, payload
    );

    return res.status(201).json({
      meeting,
      shareableLink: meeting.shareableLink,
      meetingCode: meeting.meetingCode,
    });
  } catch (error: any) {
    console.error('Schedule meeting error:', error);
    return res.status(500).json({ error: error.message || 'Failed to schedule meeting' });
  }
};

export const getBetelUserMeetings = async (req: Request, res: Response) => {
  try {
    const { token } = req.body
    console.log("Token", token)
    
    const { _Id, _TenantKey, _Email, _Name } = jwt.verify(token, JWT_SECRET) as { _Id: number, _TenantKey: string, _Email: string, _Name: string }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: _Email,
        auditId: _Id.toString(),
        auditCode: _TenantKey
      },
    })

    if (!existingUser) {
      console.log("User not found")
      return res.status(400).json({
        success: false,
        message: "Invalid Authorization of BetelAudit. Kindly Create Your account frist"
      })
    }

    const meetings = await getUserScheduledMeetings(existingUser.id);
    return res.json({ meetings });
  } catch (error: any) {
    console.log("Error fetching meeing for Audit", error)
    return res.status(500).json({ error: error.message || 'Failed to fetch meetings' });
  }
};