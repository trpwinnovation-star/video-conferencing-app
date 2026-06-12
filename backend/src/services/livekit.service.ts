import { AccessToken, RoomServiceClient, EgressClient, EncodedFileOutput, EncodedFileType } from 'livekit-server-sdk';
import 'dotenv/config';

const getLivekitConfig = () => ({
  livekitHost: process.env.LIVEKIT_URL || 'http://localhost:7880',
  apiKey: process.env.LIVEKIT_API_KEY || 'devkey',
  apiSecret: process.env.LIVEKIT_API_SECRET || 'secret'
});

const getRoomService = () => {
  const config = getLivekitConfig();
  return new RoomServiceClient(config.livekitHost, config.apiKey, config.apiSecret);
};

const getEgressClient = () => {
  const config = getLivekitConfig();
  return new EgressClient(config.livekitHost, config.apiKey, config.apiSecret);
};

export class LivekitService {
  /**
   * Generate an access token for a participant
   */
  public async generateToken(roomName: string, participantName: string, isHost: boolean = false): Promise<string> {
    const config = getLivekitConfig();
    console.log(`[LiveKit] Generating token for ${participantName} in room ${roomName}, isHost=${isHost}`);

    // ── Participant limit check ──────────────────────────────────────────────
    // Count current participants in the room (0 if room doesn't exist yet).
    // Limit: max 5 total (host + 4 attendees).
    const MAX_PARTICIPANTS = 5;
    try {
      const roomService = getRoomService();
      const participants = await roomService.listParticipants(roomName);
      if (participants.length >= MAX_PARTICIPANTS) {
        throw new Error(
          `Room is full. This meeting allows a maximum of ${MAX_PARTICIPANTS} participants.`
        );
      }
      console.log(`[LiveKit] Room ${roomName} has ${participants.length}/${MAX_PARTICIPANTS} participants — allowing join.`);
    } catch (err: any) {
      // If the error is our own capacity error, re-throw it
      if (err.message?.includes('Room is full')) throw err;
      // Otherwise the room doesn't exist yet (first participant) — allow it
      console.log(`[LiveKit] Room ${roomName} not found in LiveKit yet (first participant) — allowing.`);
    }
    // ────────────────────────────────────────────────────────────────────────

    const at = new AccessToken(config.apiKey, config.apiSecret, {
      identity: participantName,
      name: participantName,
    });

    // Set metadata explicitly (required in livekit-server-sdk v2+)
    at.metadata = JSON.stringify({ isHost });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }

  /**
   * Create a new room or get an existing one
   */
  // public async createRoom(roomName: string) {
  //   const roomService = getRoomService();
  //   console.log("Room service initialized")
  //   const room = await roomService.createRoom({
  //     name: roomName,
  //     emptyTimeout: 10 * 60, // 10 minutes
  //     maxParticipants: 5,    // Hard cap enforced by LiveKit as secondary guard
  //   });
  //   console.log("LiveKit room created or already exists:", room.sid);
  //   return room;
  // }

  public async createRoom(roomName: string) {
  try {
    const roomService = getRoomService();

    console.log("LIVEKIT_URL:", process.env.LIVEKIT_URL);
    console.log("Creating room:", roomName);

    const room = await roomService.createRoom({
      name: roomName,
      emptyTimeout: 600,
      maxParticipants: 5,
    });

    console.log("Room response:", room);

    return room;
  } catch (error) {
    console.error("LiveKit createRoom error:", error);
    throw error;
  }
}

  /**
   * List rooms
   */
  public async listRooms() {
    const roomService = getRoomService();
    return await roomService.listRooms();
  }

  /**
   * Start recording a room using LiveKit Egress
   */
  public async startRecording(roomName: string) {
    const egressClient = getEgressClient();
    try {
      const fileOutput = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: `recordings/${roomName}-${Date.now()}.mp4`,
      });

      const info = await egressClient.startRoomCompositeEgress(
        roomName,
        {
          file: fileOutput,
        },
        {
          layout: 'speaker-dark',
        }
      );

      return info;
    } catch (error) {
      console.error('Error starting egress:', error);
      throw error;
    }
  }

  /**
   * Stop an active egress recording
   */
  public async stopRecording(egressId: string) {
    const egressClient = getEgressClient();
    try {
      const info = await egressClient.stopEgress(egressId);
      return info;
    } catch (error) {
      console.error('Error stopping egress:', error);
      throw error;
    }
  }

  /**
   * Delete a room, ending the meeting for all participants
   */
  public async deleteRoom(roomName: string) {
    const roomService = getRoomService();
    try {
      await roomService.deleteRoom(roomName);
    } catch (error) {
      console.error('Error deleting room:', error);
      throw error;
    }
  }

  /**
   * List participants in a room
   */
  public async listParticipants(roomName: string) {
    const roomService = getRoomService();
    try {
      return await roomService.listParticipants(roomName);
    } catch (error) {
      // Return empty list if the room doesn't exist
      return [];
    }
  }
}
