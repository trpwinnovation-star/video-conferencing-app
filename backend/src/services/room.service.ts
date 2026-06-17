import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/db';
import { LivekitService } from './livekit.service';

const livekitService = new LivekitService();

const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

export function normalizeRoomId(roomId: string): string {
  return roomId.trim();
}

export function isValidRoomId(roomId: string): boolean {
  return ROOM_ID_REGEX.test(normalizeRoomId(roomId));
}

export async function createProtectedRoom(
  roomId: string,
  password: string,
  createdBy?: string
) {
  const id = normalizeRoomId(roomId);
  if (!isValidRoomId(id)) {
    throw new Error('Room ID must be 3–64 characters (letters, numbers, _ or -)');
  }
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }

  const existing = await prisma.room.findUnique({ where: { roomId: id } });
  if (existing) {
    throw new Error('Room already exists. Choose a different code or join instead.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const room = await prisma.room.create({
    data: {
      roomId: id,
      passwordHash,
      createdBy: createdBy ?? null,
    },
  });
  console.log("room created:", room.roomId);

  await livekitService.createRoom(id);
  console.log("LiveKit room ensured for:", id);
  return room;
}

export async function verifyRoomPassword(roomId: string, password: string): Promise<boolean> {
  const id = normalizeRoomId(roomId);
  const room = await prisma.room.findUnique({ where: { roomId: id } });
  if (!room) {
    return false;
  }
  return bcrypt.compare(password, room.passwordHash);
}

export async function getRoomOrThrow(roomId: string) {
  const id = normalizeRoomId(roomId);
  const room = await prisma.room.findUnique({ where: { roomId: id } });
  if (!room) {
    throw new Error('Room not found. Check the code or create a new meeting.');
  }
  return room;
}

/**
 * Single-query helper: fetches the room and verifies the password in one round-trip.
 * Returns the room object on success; throws descriptive errors on failure.
 * Replaces the previous pattern of getRoomOrThrow() + verifyRoomPassword() (2 queries).
 */
export async function getRoomAndVerifyPassword(roomId: string, password: string) {
  const id = normalizeRoomId(roomId);
  const room = await prisma.room.findUnique({ where: { roomId: id } });
  if (!room) {
    throw new Error('Room not found. Check the code or create a new meeting.');
  }
  const valid = await bcrypt.compare(password, room.passwordHash);
  if (!valid) {
    throw new Error('Incorrect password');
  }
  return room;
}


export async function ensureLivekitRoom(roomId: string) {
  try {
    await livekitService.createRoom(normalizeRoomId(roomId));
  } catch {
    // Room may already exist in LiveKit
  }
}

export async function deleteRoomFromDb(roomId: string) {
  const id = normalizeRoomId(roomId);
  try {
    await prisma.room.delete({ where: { roomId: id } });
  } catch (error) {
    console.warn(`Failed to delete room ${id} from DB (maybe already deleted):`, error);
  }

  try {
    // Also mark any corresponding ScheduledMeeting as completed
    await prisma.scheduledMeeting.updateMany({
      where: {
        roomId: id,
        status: { in: ['scheduled', 'in_progress'] }
      },
      data: {
        status: 'completed',
        actualEndTime: new Date()
      }
    });
  } catch (smError) {
    console.warn(`Failed to mark scheduled meeting for room ${id} as completed:`, smError);
  }

  // Clean up all meeting-related files uploaded during the session
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      const prefix = `room-${id}-`;
      files.forEach(file => {
        if (file.startsWith(prefix)) {
          const filePath = path.join(uploadsDir, file);
          fs.unlinkSync(filePath);
          console.log(`[deleteRoomFromDb] Deleted temporary file: ${file}`);
        }
      });
    }
  } catch (cleanupError) {
    console.warn(`[deleteRoomFromDb] Failed to clean up meeting files for room ${id}:`, cleanupError);
  }
}
