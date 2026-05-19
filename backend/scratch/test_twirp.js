const jwt = require('jsonwebtoken');

const LIVEKIT_URL = 'https://video-confrencing-xgol7pv4.livekit.cloud';
const LIVEKIT_API_KEY = 'API82tahs5ErKQD';
const LIVEKIT_API_SECRET = 'mZ7fpu2GWMnopF7t1jQMDuT3KZzBi8JPrPUHQdczi7C';

async function testTwirp() {
  const roomName = 'testroom';
  
  // Generate a JWT with roomRecord permission
  const token = jwt.sign(
    {
      video: { roomRecord: true },
      iss: LIVEKIT_API_KEY,
      sub: LIVEKIT_API_KEY,
    },
    LIVEKIT_API_SECRET,
    { algorithm: 'HS256', expiresIn: '10m' }
  );

  const payload = {
    roomName: roomName,
    layout: 'grid',
    fileOutputs: [
      {
        fileType: 'MP4',
        filepath: `rec-${roomName}-${Date.now()}.mp4`,
        s3: {
          accessKey: 'dummy',
          secret: 'dummy',
          bucket: 'dummy',
          endpoint: 'https://s3.amazonaws.com',
          region: 'us-east-1'
        }
      }
    ]
  };

  console.log('Sending payload:', JSON.stringify(payload, null, 2));

  try {
    const res = await fetch(`${LIVEKIT_URL}/twirp/livekit.Egress/StartRoomCompositeEgress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testTwirp();
