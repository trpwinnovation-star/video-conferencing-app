const { RoomServiceClient, EgressClient } = require('livekit-server-sdk');

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
      
      const { EncodedFileOutput, EncodedFileType } = require('livekit-server-sdk');
      const outputConfig = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: `rec-${roomName}-${Date.now()}.mp4`,
        s3: {
          accessKey: 'dummy',
          secret: 'dummy',
          bucket: 'dummy',
          endpoint: 'https://s3.amazonaws.com',
          region: 'us-east-1'
        }
      });

      const info = await egressClient.startRoomCompositeEgress(
        roomName,
        { file: outputConfig },
        { layout: 'grid' }
      );
      console.log('Egress started successfully:', info);
    } else {
      console.log('No rooms found. Cannot test Egress on an empty server.');
    }
  } catch (error) {
    console.error('Test failed with error:');
    console.error(error.message);
    if (error.response) {
      console.error(error.response.data);
    }
  }
}

test();
