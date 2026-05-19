import { EgressClient, EncodedFileType, EncodedFileOutput } from 'livekit-server-sdk';

// Mock client
const client = new EgressClient('https://dummy.livekit.cloud', 'key', 'secret');

const roomName = 'test-room';
const fileOutput = new EncodedFileOutput({
  fileType: EncodedFileType.MP4,
  filepath: 'test.mp4',
});

// Access internal getOutputParams to see what it produces
const anyClient = client as any;
const params = anyClient.getOutputParams(fileOutput);
console.log('getOutputParams result:', JSON.stringify(params, null, 2));

// Test with wrapped version
const paramsWrapped = anyClient.getOutputParams({ file: fileOutput });
console.log('getOutputParams (wrapped) result:', JSON.stringify(paramsWrapped, null, 2));
