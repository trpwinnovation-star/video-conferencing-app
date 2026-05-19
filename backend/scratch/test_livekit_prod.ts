import { RoomServiceClient, EgressClient } from 'livekit-server-sdk';

const LIVEKIT_URL = 'https://video-confrencing-xgol7pv4.livekit.cloud';
const LIVEKIT_API_KEY = 'API82tahs5ErKQD';
const LIVEKIT_API_SECRET = 'mZ7fpu2GWMnopF7t1jQMDuT3KZzBi8JPrPUHQdczi7C';

async function test() {
  const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

  try {
    console.log('Listing rooms...');
    const rooms = await roomService.listRooms();
    console.log('Rooms:', rooms.map(r => r.name));

    if (rooms.length > 0) {
      const roomName = rooms[0].name;
      console.log(`Trying to start egress for room: ${roomName}`);
      
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
          output: {
            case: 'file',
            value: outputConfig
          }
        } as any,
        'grid'
      );
      console.log('Egress started successfully:', info);
    } else {
      console.log('No rooms found. Cannot test Egress on an empty server.');
    }
  } catch (error: any) {
    console.error('Test failed with error:');
    console.error(error.message);
    if (error.response) {
      console.error(error.response.data);
    }
  }
}

test();
