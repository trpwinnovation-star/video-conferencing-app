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
    // Using the most stable positional argument signature
    // (roomName, output, layout)
    // 2 = EncodedFileType.MP4
    const info = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        fileType: 2,
        filepath: `recording-${roomName}-${Date.now()}.mp4`,
      } as any,
      'grid'
    );

    console.log(`Egress started with ID: ${info.egressId}`);
    return info;
  } catch (error: any) {
    console.error('Failed to start egress recording. Full error:', JSON.stringify(error, null, 2));
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
