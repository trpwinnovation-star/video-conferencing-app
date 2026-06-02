const getApiBase = () => {
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  if (url.endsWith('/')) url = url.slice(0, -1);
  if (url.endsWith('/api')) url = url.slice(0, -4);
  return url;
};

const API_ROOT = getApiBase();
const API_BASE = `${API_ROOT}/api`;
const ROOMS_URL = `${API_BASE}/rooms`;
const AUTH_URL = `${API_BASE}/auth`;
const RECORDINGS_URL = `${API_BASE}/recording`;

const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
  const headers: Record<string, string> = { ...extraHeaders };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// ---- Recording APIs ----
export async function uploadRecording(blob: Blob, fileName: string) {
  const formData = new FormData();
  formData.append('recording', blob, fileName);

  const response = await fetch(`${RECORDINGS_URL}/upload`, {
    method: 'POST',
    body: formData,
    // Note: Don't set Content-Type header when sending FormData, 
    // the browser will set it automatically with the correct boundary
    credentials: 'include',
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to upload recording');
  }

  return await response.json();
}

// ---- Room APIs ----
export async function createProtectedRoom(roomId: string, password: string) {
  const response = await fetch(`${ROOMS_URL}/create-protected`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ roomId, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to create room');
  return data.room as { roomId: string; createdAt: string };
}

export async function verifyRoomPassword(roomId: string, password: string) {
  const response = await fetch(`${ROOMS_URL}/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ roomId, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Incorrect password');
  return true;
}

export async function getToken(
  roomName: string,
  participantName: string,
  password: string
) {
  let response: Response;
  try {
    response = await fetch(`${ROOMS_URL}/token`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ roomName, participantName, password }),
    });
  } catch {
    throw new Error(
      'Cannot reach the API server. Redeploy the frontend with NEXT_PUBLIC_API_URL set to your backend URL.'
    );
  }

  let data: { token?: string; error?: string; details?: string };
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? 'Invalid response from server'
        : `API error (${response.status}). Check NEXT_PUBLIC_API_URL on the frontend service.`
    );
  }

  if (!response.ok) {
    throw new Error(data.details || data.error || 'Failed to generate token');
  }
  if (!data.token) {
    throw new Error('No token received from server');
  }
  return data.token;
}

export async function startEgressRecording(roomName: string) {
  const response = await fetch(`${API_BASE}/egress/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ roomName }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to start egress recording');
  }
  return await response.json();
}

export async function stopEgressRecording(egressId: string) {
  const response = await fetch(`${API_BASE}/egress/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ egressId }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to stop egress recording');
  }
  return await response.json();
}

export async function apiEndMeeting(roomName: string) {
  const response = await fetch(`${ROOMS_URL}/end-meeting`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ roomName }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to end meeting');
  }
  return await response.json();
}

export async function checkRoomStatus(roomName: string): Promise<{ exists: boolean; status: string }> {
  const response = await fetch(`${ROOMS_URL}/check-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ roomName }),
  });
  if (!response.ok) {
    const err = await response.json();
    console.warn('Failed to check room status:', err);
    // If we can't check, assume room exists (fail safe)
    return { exists: true, status: 'unknown' };
  }
  return await response.json();
}

// ---- Legacy/Mock Recording APIs (Local only) ----
export async function startRecording(roomName: string) {
  console.log('Local recording started for room:', roomName);
  return { status: 'mock_started' };
}

export async function apiGetMyRecordings() {
  const response = await fetch(`${RECORDINGS_URL}/my`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch recordings');
  }
  return await response.json();
}

export async function stopRecording(id?: string) {
  console.log('Local recording stopped');
  return { status: 'mock_stopped' };
}

// ---- Auth APIs ----
export interface User {
  id: string;
  email: string;
  name: string;
}

export async function apiRegister(name: string, email: string, password: string): Promise<User> {
  const res = await fetch(`${AUTH_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  if (data.token && typeof window !== 'undefined') localStorage.setItem('auth_token', data.token);
  return data.user;
}

export async function apiLogin(email: string, password: string): Promise<User> {
  const res = await fetch(`${AUTH_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  if (data.token && typeof window !== 'undefined') localStorage.setItem('auth_token', data.token);
  return data.user;
}

export async function apiLogout(): Promise<void> {
  if (typeof window !== 'undefined') localStorage.removeItem('auth_token');
  await fetch(`${AUTH_URL}/logout`, { method: 'POST', credentials: 'include' });
}

export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${AUTH_URL}/change-password`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to change password');
  }
}

export async function apiForgotPassword(email: string): Promise<string> {
  const res = await fetch(`${AUTH_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to process request');
  return data.message;
}

export async function apiResetPassword(token: string, newPassword: string): Promise<string> {
  const res = await fetch(`${AUTH_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reset password');
  return data.message;
}

export async function apiGetMe(): Promise<User | null> {
  try {
    const res = await fetch(`${AUTH_URL}/me`, { 
      headers: getAuthHeaders(),
      credentials: 'include' 
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}

// ---- Scheduled Meetings APIs ----
const SCHEDULED_MEETINGS_URL = `${API_BASE}/scheduled-meetings`;

export interface ScheduledMeeting {
  id: string;
  title: string;
  description?: string;
  roomId: string;
  hostId: string;
  scheduledTime: string;
  durationMinutes: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  shareableLink: string;
  meetingCode: string;
  hostJoinedAt?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  host?: User;
  attendees?: any[];
  createdAt: string;
  updatedAt: string;
}

export async function apiScheduleMeeting(
  title: string,
  description: string | undefined,
  scheduledTime: Date,
  durationMinutes: number = 60,
  attendeeEmails: string[] = []
): Promise<{ meeting: ScheduledMeeting; shareableLink: string; meetingCode: string }> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/schedule`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({
      title,
      description,
      scheduledTime: scheduledTime.toISOString(),
      durationMinutes,
      attendeeEmails,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to schedule meeting');
  return data;
}

export async function apiGetUserMeetings(): Promise<{ meetings: ScheduledMeeting[] }> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/meetings`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch meetings');
  }

  return await res.json();
}

export async function apiGetUpcomingMeetings(): Promise<{ meetings: ScheduledMeeting[] }> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/upcoming`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch meetings');
  }

  return await res.json();
}

export async function apiGetScheduledMeeting(meetingId: string): Promise<ScheduledMeeting> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/meeting/${meetingId}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch meeting');
  }

  return await res.json();
}

export async function apiJoinScheduledMeeting(meetingId: string): Promise<{
  token: string;
  roomId: string;
  meeting: ScheduledMeeting;
}> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/meeting/${meetingId}/join`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to join meeting');
  return data;
}

export async function apiEndScheduledMeeting(meetingId: string): Promise<{ message: string }> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/meeting/${meetingId}/end`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to end meeting');
  return data;
}

export async function apiGetMeetingByCode(roomId: string): Promise<{
  id: string;
  title: string;
  description?: string;
  scheduledTime: string;
  host: User;
  status: string;
  hostJoinedAt?: string;
}> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/code/${roomId}`);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Meeting not found');
  }

  return await res.json();
}

export async function apiGetAttendeeToken(
  roomId: string,
  participantName: string
): Promise<{ token: string; roomId: string; meeting: ScheduledMeeting }> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/code/${roomId}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantName }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get token');
  return data;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedMeetingId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export async function apiGetNotifications(): Promise<{
  notifications: Notification[];
  unreadCount: number;
}> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/notifications`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch notifications');
  }

  return await res.json();
}

export async function apiMarkNotificationAsRead(notificationId: string): Promise<{ message: string }> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update notification');
  return data;
}

export async function apiMarkAllNotificationsAsRead(): Promise<{ message: string }> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/notifications/read-all`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update notifications');
  return data;
}
