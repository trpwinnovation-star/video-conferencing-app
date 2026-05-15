import { EgressClient, EncodedFileOutput, EncodedFileType } from 'livekit-server-sdk';

const client = new EgressClient('http://localhost', 'key', 'secret');

console.log('Methods on EgressClient:');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(client)));

// Test what the types expect
const output = new EncodedFileOutput({
  fileType: EncodedFileType.MP4,
  filepath: 'test.mp4',
});

console.log('EncodedFileOutput keys:', Object.keys(output));
