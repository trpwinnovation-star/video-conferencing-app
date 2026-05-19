import { RoomCompositeEgressRequest, EncodedFileOutput, EncodedFileType } from 'livekit-server-sdk';

const roomName = 'test-room';
const fileOutput = new EncodedFileOutput({
  fileType: EncodedFileType.MP4,
  filepath: 'test.mp4',
});

// Create request using the constructor style the SDK uses
const req = new RoomCompositeEgressRequest({
  roomName,
  layout: 'grid',
  fileOutputs: [fileOutput],
  output: {
    case: 'file',
    value: fileOutput
  }
} as any);

console.log('JSON stringified request:', JSON.stringify(req));
console.log('toJson() request:', JSON.stringify(req.toJson()));
