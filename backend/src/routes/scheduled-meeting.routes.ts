import express from 'express';
import {
  scheduleNewMeeting,
  getScheduledMeetingDetails,
  getUserMeetings,
  getUpcomingUserMeetings,
  joinScheduledMeeting,
  endScheduledMeeting,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getMeetingByCode,
  getAttendeeToken,
  getAuditMeetStatus,
  updateMeeting,
  scheduleAuditMeeting,
  updateScheduleAuditMeeting,
  getBetelUserMeetings
} from '../controllers/scheduled-meeting.controller';

const router = express.Router();

// Scheduled meeting endpoints
router.post('/schedule', scheduleNewMeeting);                      // POST /api/scheduled-meetings/schedule
router.get('/meetings', getUserMeetings);                          // GET /api/scheduled-meetings/meetings
router.get('/upcoming', getUpcomingUserMeetings);                  // GET /api/scheduled-meetings/upcoming
router.get('/meeting/:meetingId', getScheduledMeetingDetails);     // GET /api/scheduled-meetings/meeting/:id
router.put('/meeting/:meetingId', updateMeeting);                 // PUT /api/scheduled-meetings/meeting/:id
router.post('/meeting/:meetingId/join', joinScheduledMeeting);     // POST /api/scheduled-meetings/meeting/:id/join
router.post('/meeting/:meetingId/end', endScheduledMeeting);       // POST /api/scheduled-meetings/meeting/:id/end

// Meeting join by code (public)
router.get('/code/:roomId', getMeetingByCode);                     // GET /api/scheduled-meetings/code/:roomId
router.post('/code/:roomId/token', getAttendeeToken);              // POST /api/scheduled-meetings/code/:roomId/token

// Notification endpoints
router.get('/notifications', getNotifications);                    // GET /api/scheduled-meetings/notifications
router.post('/notifications/:notificationId/read', markNotificationRead);  // POST /api/scheduled-meetings/notifications/:id/read
router.post('/notifications/read-all', markAllNotificationsRead);  // POST /api/scheduled-meetings/notifications/read-all

// BetelAudit endpoints

router.post('/auditMeetStatus', getAuditMeetStatus)
router.post('/auditSchedule', scheduleAuditMeeting)
router.post('/auditScheduleUpdate', updateScheduleAuditMeeting)
router.post('/betelmeetings', getBetelUserMeetings);  

export default router;
