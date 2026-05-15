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
    console.log(`Starting Egress recording for room: "${roomName}"`);
    console.log(`Targeting LiveKit Egress URL: ${egressUrl}`);
    
    // Dual-Compatible Request Strategy:
    // We provide the output in multiple formats to satisfy both old and new LiveKit servers.
    const outputConfig = {
      fileType: 2, // MP4
      filepath: `rec-${roomName}-${Date.now()}.mp4`,
    };

    const info = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        ...outputConfig,
        file: outputConfig,
        fileOutputs: [outputConfig],
        // Legacy 'output' wrapper required by some server versions
        output: {
          case: 'file',
          value: outputConfig
        }
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
