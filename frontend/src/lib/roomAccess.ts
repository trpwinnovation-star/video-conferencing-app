const STORAGE_PREFIX = 'room_access_';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredPassword {
  password: string;
  expiresAt: number; // Unix timestamp ms
}

export function saveRoomPassword(roomId: string, password: string) {
  if (typeof window === 'undefined') return;
  const entry: StoredPassword = {
    password,
    expiresAt: Date.now() + TTL_MS,
  };
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${roomId}`, JSON.stringify(entry));
  } catch {
    // localStorage unavailable (private mode, storage full)
  }
}

export function getStoredRoomPassword(roomId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${roomId}`);
    if (!raw) return null;

    // Support old format (plain string) gracefully
    if (!raw.startsWith('{')) return raw;

    const entry: StoredPassword = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      // Expired — clean up and return null
      localStorage.removeItem(`${STORAGE_PREFIX}${roomId}`);
      return null;
    }
    return entry.password;
  } catch {
    return null;
  }
}

export function clearRoomPassword(roomId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${roomId}`);
  } catch {
    // ignore
  }
}

/** Parse room code from pasted link or raw code */
export function parseRoomInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const match = url.pathname.match(/\/room\/([^/?#]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // not a URL
  }

  return trimmed.split('?')[0].split('/').pop() || trimmed;
}

export function buildRoomInviteLink(roomId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/room/${encodeURIComponent(roomId)}`;
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${base}/room/${encodeURIComponent(roomId)}`;
}
