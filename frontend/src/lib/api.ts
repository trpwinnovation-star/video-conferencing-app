const getApiBase = () => {
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  if (url.endsWith('/')) url = url.slice(0, -1);
  if (url.endsWith('/api')) url = url.slice(0, -4);
  return url;
};

export const API_ROOT = getApiBase();
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

export async function apiGetMeetingRecordings(meetingId: string) {
  const response = await fetch(`${RECORDINGS_URL}/meeting/${meetingId}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch recordings for this meeting');
  }
  return await response.json();
}

/**
 * Fetches recording metadata (status, downloadCount, expiresAt, etc.)
 * WITHOUT incrementing the download counter. Safe to call on page load.
 */
export async function apiGetRecordingInfo(recordingId: string) {
  const response = await fetch(`${RECORDINGS_URL}/${recordingId}/info`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch recording info');
  }
  return await response.json();
}

/**
 * Strictly enforced download via backend proxy.
 *
 * - Calls GET /recording/:id/download (requires auth)
 * - Backend checks count < 3 and expiry, then increments the counter
 * - Backend fetches from S3 server-side and streams bytes back
 * - We receive the raw video bytes as a Blob — the S3 URL never reaches the browser
 * - A temporary blob:// URL is created, used to trigger the Save dialog, then revoked
 *
 * @returns the new downloadCount after this download
 */
export async function apiDownloadRecording(
  recordingId: string,
  fileName: string
): Promise<{ downloadCount: number }> {
  const response = await fetch(`${RECORDINGS_URL}/${recordingId}/download`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    // Error responses are JSON
    const err = await response.json();
    throw new Error(err.error || 'Download failed');
  }

  // Read the full video as a binary blob
  const blob = await response.blob();

  // Create a temporary local URL and trigger the browser Save dialog
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke immediately — the blob URL is now useless even if copied
  URL.revokeObjectURL(blobUrl);

  // Backend sends the new count in a response header
  const newCount = parseInt(response.headers.get('X-Download-Count') || '0', 10);
  return { downloadCount: newCount };
}



// ---- Auth APIs ----
export interface User {
  id: string;
  email: string;
  name: string;
  role?: 'USER' | 'ADMIN';
  meetingDefaultPassword?: string;
}

// ---- Admin APIs ----
const ADMIN_URL = `${API_BASE}/admin`;

export async function apiListUsers(): Promise<{ users: User[] }> {
  const res = await fetch(`${ADMIN_URL}/users`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list users');
  return data;
}

export async function apiCreateUser(payload: { name: string; email: string; role: 'USER' | 'ADMIN'; password?: string }): Promise<User> {
  const res = await fetch(`${ADMIN_URL}/users`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create user');
  return data.user;
}

export async function apiDeleteUser(userId: string): Promise<{ message: string }> {
  const res = await fetch(`${ADMIN_URL}/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete user');
  return data;
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

export async function apiUpdateDefaultPassword(meetingDefaultPassword: string): Promise<User> {
  const res = await fetch(`${AUTH_URL}/default-password`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ meetingDefaultPassword }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update default meeting password');
  }
  return data.user;
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
  attendeeEmails: string[] = [],
  password?: string
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
      password,
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

export async function apiGetScheduledMeetingDetails(meetingId: string): Promise<ScheduledMeeting> {
  return apiGetScheduledMeeting(meetingId);
}

export async function apiUpdateScheduledMeeting(
  meetingId: string,
  data: {
    title?: string;
    description?: string;
    scheduledTime?: string;
    durationMinutes?: number;
    password?: string;
    attendeeEmails?: string[];
  }
): Promise<{ meeting: ScheduledMeeting }> {
  const res = await fetch(`${SCHEDULED_MEETINGS_URL}/meeting/${meetingId}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const resData = await res.json();
  if (!res.ok) throw new Error(resData.error || 'Failed to update meeting');
  return resData;
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

export async function apiUploadSharedFile(file: File, roomId: string): Promise<{
  fileUrl: string;
  fileName: string;
  fileSize: number;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${ROOMS_URL}/upload-file?roomId=${encodeURIComponent(roomId)}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to upload file');
  return data;
}

