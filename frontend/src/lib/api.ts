const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const ROOMS_URL = `${API_BASE}/rooms`;
const AUTH_URL = `${API_BASE}/auth`;
const RECORDINGS_URL = `${API_BASE}/recordings`;

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
export async function getToken(roomName: string, participantName: string) {
  const response = await fetch(`${ROOMS_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ roomName, participantName }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.details || err.error || 'Failed to generate token');
  }
  const data = await response.json();
  return data.token;
}

export async function startRecording(roomName: string) {
  const response = await fetch(`${ROOMS_URL}/recording/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ roomName }),
  });
  if (!response.ok) throw new Error('Failed to start recording');
  return await response.json();
}

export async function stopRecording(egressId: string) {
  const response = await fetch(`${ROOMS_URL}/recording/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ egressId }),
  });
  if (!response.ok) throw new Error('Failed to stop recording');
  return await response.json();
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
  return data.user;
}

export async function apiLogout(): Promise<void> {
  await fetch(`${AUTH_URL}/logout`, { method: 'POST', credentials: 'include' });
}

export async function apiGetMe(): Promise<User | null> {
  try {
    const res = await fetch(`${AUTH_URL}/me`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}
