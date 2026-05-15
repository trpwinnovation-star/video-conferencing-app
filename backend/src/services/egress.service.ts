import { EgressClient, EncodedFileType, EncodedFileOutput } from 'livekit-server-sdk';
import path from 'path';

const livekitUrl = process.env.LIVEKIT_URL || '';
// Egress requires an HTTPS URL. Convert wss:// to https:// if necessary.
const egressUrl = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');

const egressClient = new EgressClient(
  egressUrl,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

/**
 * Starts a server-side room recording using LiveKit Egress.
 * This captures all participants and screen shares in a grid layout.
 */
export async function startRoomRecording(roomName: string) {
  try {
    console.log(`Starting Egress recording for room: ${roomName}`);

    // In livekit-server-sdk v2.x, startRoomCompositeEgress takes multiple arguments:
    // (roomName, output, options)
    // We pass the output config directly to ensure legacy 'output' field is also set.
    const info = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        fileType: EncodedFileType.MP4,
        filepath: `${roomName}-${Date.now()}.mp4`,
      } as any,
      {
        layout: 'grid',
      }
    );

    console.log(`Egress started with ID: ${info.egressId}`);
    return info;
  } catch (error) {
    console.error('Failed to start egress recording:', error);
    throw error;
  }
}

/**
 * Stops an ongoing Egress recording.
 */
export async function stopRoomRecording(egressId: string) {
  try {
    console.log(`Stopping Egress recording: ${egressId}`);
    const info = await egressClient.stopEgress(egressId);
    console.log(`Egress stopped: ${info.egressId}`);
    return info;
  } catch (error) {
    console.error('Failed to stop egress recording:', error);
    throw error;
  }
}
