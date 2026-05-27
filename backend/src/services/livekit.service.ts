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
  public async createRoom(roomName: string) {
    const roomService = getRoomService();
    const room = await roomService.createRoom({
      name: roomName,
      emptyTimeout: 10 * 60, // 10 minutes
      maxParticipants: 50,
    });
    return room;
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
}
