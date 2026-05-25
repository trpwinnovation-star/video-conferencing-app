const STORAGE_PREFIX = 'room_access_';

export function saveRoomPassword(roomId: string, password: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${STORAGE_PREFIX}${roomId}`, password);
}

export function getStoredRoomPassword(roomId: string): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(`${STORAGE_PREFIX}${roomId}`);
}

export function clearRoomPassword(roomId: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(`${STORAGE_PREFIX}${roomId}`);
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
