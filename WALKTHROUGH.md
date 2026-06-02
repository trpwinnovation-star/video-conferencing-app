# Video Conferencing Application - Complete Codebase Walkthrough

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Database Layer](#database-layer)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Features & How They Work](#features--how-they-work)
7. [Deployment](#deployment)

---

## Project Overview

**BetelMeet** is a full-stack video conferencing application built with:

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 with TypeScript, React 19, Tailwind CSS |
| **Backend** | Node.js/Express with TypeScript |
| **Database** | PostgreSQL with Prisma ORM |
| **Real-time Video** | LiveKit (WebRTC-based) |
| **Storage** | AWS S3 for recordings |
| **Email** | Resend API for transactional emails |

**Key Features:**
- User authentication (sign up, login, password reset)
- Create/join password-protected video rooms
- Real-time video & audio conferencing
- Local screen recording (up to 1 hour with 5-minute countdown warning)
- Recording playback and download
- Participant management and presence tracking

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│  (Browser) - Pages, Components, Contexts, API Calls            │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTP/WebSocket
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                  Backend (Express/Node.js)                      │
│  Routes → Controllers → Services → Database/External APIs      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Auth       │  │   Room       │  │  Recording   │          │
│  │  Controller  │  │  Controller  │  │  Controller  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Auth        │  │  Room        │  │  Recording   │          │
│  │  Service     │  │  Service     │  │  Service     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │  S3          │  │  Email       │                            │
│  │  Service     │  │  Service     │                            │
│  └──────────────┘  └──────────────┘                            │
│                                                                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
      ┌──────────┴──────────┬──────────────┬──────────────┐
      │                     │              │              │
┌─────▼──────┐  ┌──────────▼──┐  ┌───────▼────┐  ┌──────▼─────┐
│ PostgreSQL │  │  LiveKit    │  │   AWS S3   │  │  Resend    │
│ Database   │  │  Cloud      │  │  Storage   │  │  Email API │
└────────────┘  └─────────────┘  └────────────┘  └────────────┘
```

---

## Database Layer

### 1. Database Connection & Setup

**File:** `backend/prisma/schema.prisma`

```typescript
// Database connection
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // Example: postgresql://user:password@host:5432/dbname
}

// Prisma Client generator
generator client {
  provider = "prisma-client-js"
}
```

**Connection String Format:**
```
postgresql://username:password@localhost:5432/video_conferencing_db
```

### 2. Database Models

#### User Model
```typescript
model User {
  id        String   @id @default(uuid())      // Unique user ID
  email     String   @unique                   // Email must be unique
  password  String                             // Bcrypt hashed password
  name      String                             // User display name
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**What it stores:**
- User accounts for the application
- Email used for login and password reset
- Password is hashed using bcrypt (10 rounds) before storing
- Used for authentication and user profiles

**Queries:**
```typescript
// Register user
prisma.user.create({
  data: { email, password: hashedPassword, name }
})

// Login - find user by email
prisma.user.findUnique({ where: { email } })
```

---

#### Room Model
```typescript
model Room {
  id           String   @id @default(uuid())    // Primary key
  roomId       String   @unique                 // Custom room code (e.g., "abc123")
  passwordHash String                           // Bcrypt hashed password
  createdBy    String?                          // User ID who created the room
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**What it stores:**
- Password-protected video conference rooms
- Each room has a unique code that users enter to join
- Passwords are hashed with bcrypt for security
- Tracks who created the room (for future features)

**Room ID Validation Rules:**
- 3-64 characters
- Only alphanumeric, underscores, and hyphens allowed
- Examples: `abc123`, `my-meeting-01`, `team_standup`

**Queries:**
```typescript
// Create room with password
const passwordHash = await bcrypt.hash(password, 10)
prisma.room.create({
  data: { roomId: "abc123", passwordHash, createdBy: userId }
})

// Verify room password
const room = prisma.room.findUnique({ where: { roomId: "abc123" } })
const isValid = await bcrypt.compare(password, room.passwordHash)
```

---

#### Recording Model
```typescript
model Recording {
  id                String   @id @default(uuid())
  roomId            String                      // Which room was recorded
  meetingId         String                      // Unique session ID
  createdBy         String?                     // User who started recording
  participants      String?                     // List of participants
  duration          Int?                        // Recording duration in seconds
  fileSize          Int?                        // File size in bytes
  s3Key             String?                     // AWS S3 object key
  signedUrl         String?                     // Temporary download URL
  status            String                      // 'recording', 'processing', 'completed', 'failed'
  failureReason     String?                     // Error message if failed
  downloadCount     Int      @default(0)        // How many times downloaded
  downloadExpiresAt DateTime?                   // When signed URL expires
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**What it stores:**
- Metadata about recorded meetings
- Links to files stored in AWS S3
- Processing status and error tracking
- Download expiration dates (for security)

**Recording Lifecycle:**
1. **recording** → User starts recording → `startRecording()` is called
2. **processing** → Recording finishes → chunks are merged and uploaded to S3
3. **completed** → Upload succeeds → signed URL is generated
4. **failed** → Upload fails → error is saved

**Queries:**
```typescript
// Start recording session
prisma.recording.create({
  data: { roomId, meetingId, createdBy, status: 'recording' }
})

// Update to completed with S3 details
prisma.recording.update({
  where: { id: recordingId },
  data: { 
    status: 'completed', 
    s3Key: 's3://bucket/file.webm',
    fileSize: bytes
  }
})

// Get recording by ID
prisma.recording.findUnique({ where: { id: recordingId } })
```

### 3. Database Workflow Example

**When a user joins a room:**
```
1. Frontend calls: GET /api/rooms/token
2. Backend checks: Does room exist in Database?
   - If NO: Room doesn't exist → Error
   - If YES: Continue
3. Backend verifies password (bcrypt comparison)
4. Backend creates LiveKit token
5. Frontend joins meeting using token
```

---

## Backend Implementation

### Directory Structure

```
backend/
├── index.ts                          // Express app setup & routes
├── package.json                      // Dependencies
├── tsconfig.json                     // TypeScript config
├── prisma/
│   ├── schema.prisma                // Database models
│   └── migrations/                  // Database change history
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts       // User auth handlers
│   │   ├── room.controller.ts       // Room creation/joining
│   │   ├── recording.controller.ts  // Recording management
│   │   └── egress.controller.ts     // LiveKit egress (optional)
│   │
│   ├── services/
│   │   ├── room.service.ts          // Room business logic
│   │   ├── livekit.service.ts       // LiveKit SDK wrapper
│   │   ├── recording.service.ts     // Recording processing
│   │   ├── s3.service.ts            // AWS S3 operations
│   │   └── email.service.ts         // Email sending
│   │
│   ├── routes/
│   │   ├── auth.routes.ts           // /api/auth/* endpoints
│   │   ├── room.routes.ts           // /api/rooms/* endpoints
│   │   ├── recording.routes.ts      // /api/recording/* endpoints
│   │   └── egress.routes.ts         // /api/egress/* endpoints
│   │
│   └── middleware/
│       └── upload.middleware.ts     // Multer file upload config
```

### Main Entry Point: `backend/index.ts`

```typescript
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// ✅ Trust proxy for production (Render)
app.set("trust proxy", 1);

// ✅ CORS Configuration
const allowedOrigins = [
  "https://video-confrencing-frontend.onrender.com",  // Production
  "http://localhost:3000",                              // Local dev
];

app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin)) {
      callback(null, true);  // Allow request
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,  // Allow cookies
}));

// ✅ Body parsers
app.use(express.json());
app.use(cookieParser());

// ✅ Mount route handlers
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/recording", recordingRoutes);
app.use("/api/egress", egressRoutes);

// ✅ Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: err.message });
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});
```

**Key Configuration:**
- `trust proxy`: Required on Render to correctly identify client IP
- `CORS`: Only allows frontend origin to prevent unauthorized requests
- `credentials: true`: Enables HTTP-only cookies for auth tokens

---

### Layer 1: Routes

**File:** `backend/src/routes/auth.routes.ts`

Routes are the entry points. They map HTTP requests to controller functions.

```typescript
import express from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller';

const router = express.Router();

// Public routes (no auth required)
router.post('/register', register);        // POST /api/auth/register
router.post('/login', login);              // POST /api/auth/login
router.post('/logout', logout);            // POST /api/auth/logout

// Protected routes
router.get('/me', getMe);                  // GET /api/auth/me

export default router;
```

**Room Routes:**
```typescript
router.post('/create-protected', createProtectedRoomHandler);
router.post('/verify-password', verifyRoomPasswordHandler);
router.post('/token', generateToken);
router.get('/status/:roomId', checkRoomStatus);
```

**Recording Routes:**
```typescript
router.post('/start', startRecording);
router.post('/upload-chunk', uploadChunk);
router.post('/finish', finishRecording);
router.get('/recording/:recordingId', getRecording);
```

---

### Layer 2: Controllers

Controllers handle the HTTP request/response. They:
1. Extract data from request
2. Call services to process data
3. Return response

**Example:** `backend/src/controllers/auth.controller.ts`

```typescript
export const register = async (req: Request, res: Response) => {
  try {
    // 1. Extract data
    const { email, password, name } = req.body;
    
    // 2. Validate
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // 3. Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // 4. Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create user in database
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name }
    });

    // 6. Create JWT token (expires in 7 days)
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 7. Set HTTP-only cookie for security
    res.cookie('token', token, {
      httpOnly: true,      // Can't be accessed by JavaScript
      secure: true,        // Only sent over HTTPS
      sameSite: 'none',    // Allow cross-site (for Render)
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days in milliseconds
    });

    // 8. Return response
    return res.json({ token, user: { id: user.id, email, name } });
  } catch (error) {
    return res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2. Compare password with hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 4. Set cookie and return
    res.cookie('token', token, authCookieOptions);
    return res.json({ token, user: { id: user.id, email, name } });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    // 1. Extract token from cookie or Authorization header
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
      id: string;
      email: string;
      name: string;
    };

    // 3. Fetch user from database
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    
    return res.json(user);
  } catch (error) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
};
```

**Key Security Features:**
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with 7-day expiration
- HTTP-only cookies prevent XSS attacks
- Tokens can be sent in headers or cookies

---

**Example:** `backend/src/controllers/room.controller.ts`

```typescript
export const createProtectedRoomHandler = async (req: Request, res: Response) => {
  try {
    const { roomId, password } = req.body;

    // 1. Extract user from JWT token
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };
    const createdBy = decoded.id;

    // 2. Call service to create room
    const room = await createProtectedRoom(roomId, password, createdBy);

    // 3. Return room details
    return res.status(201).json({
      room: { roomId: room.roomId, createdAt: room.createdAt }
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

export const generateToken = async (req: Request, res: Response) => {
  try {
    const { roomName, participantName, password } = req.body;

    // 1. Verify room exists and password is correct
    const id = normalizeRoomId(roomName);
    if (!isValidRoomId(id)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }

    await getRoomOrThrow(id);
    const valid = await verifyRoomPassword(id, password);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // 2. Determine if user is host (token owner)
    let isHost = false;
    let token = req.cookies?.token;
    if (token || req.headers.authorization?.startsWith('Bearer ')) {
      if (!token) {
        token = req.headers.authorization.substring(7);
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };
        // Check if this user is the room creator
        const room = await getRoomOrThrow(id);
        isHost = room.createdBy === decoded.id;
      } catch (e) {
        // Token invalid or user not authenticated
      }
    }

    // 3. Generate LiveKit token
    const livekitService = new LivekitService();
    const livekitToken = await livekitService.generateToken(
      id,
      participantName,
      isHost  // Pass host status to token
    );

    // 4. Ensure LiveKit room exists
    await ensureLivekitRoom(id);

    return res.json({ token: livekitToken });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
```

---

### Layer 3: Services

Services contain the business logic. They interact with databases, external APIs, and perform calculations.

**File:** `backend/src/services/room.service.ts`

```typescript
// Validate room ID format
export function isValidRoomId(roomId: string): boolean {
  const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;
  return ROOM_ID_REGEX.test(roomId);
}

// Create a new password-protected room
export async function createProtectedRoom(
  roomId: string,
  password: string,
  createdBy?: string
) {
  // 1. Validate inputs
  const id = normalizeRoomId(roomId);
  if (!isValidRoomId(id)) {
    throw new Error('Room ID must be 3–64 characters (letters, numbers, _ or -)');
  }
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }

  // 2. Check if room already exists
  const existing = await prisma.room.findUnique({ where: { roomId: id } });
  if (existing) {
    throw new Error('Room already exists. Choose a different code.');
  }

  // 3. Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // 4. Create room in database
  const room = await prisma.room.create({
    data: {
      roomId: id,
      passwordHash,
      createdBy: createdBy ?? null,
    },
  });

  // 5. Create room in LiveKit (WebRTC server)
  await livekitService.createRoom(id);

  return room;
}

// Verify password matches room's password hash
export async function verifyRoomPassword(
  roomId: string,
  password: string
): Promise<boolean> {
  const id = normalizeRoomId(roomId);
  const room = await prisma.room.findUnique({ where: { roomId: id } });
  if (!room) return false;
  return bcrypt.compare(password, room.passwordHash);
}

// Get room or throw error
export async function getRoomOrThrow(roomId: string) {
  const id = normalizeRoomId(roomId);
  const room = await prisma.room.findUnique({ where: { roomId: id } });
  if (!room) {
    throw new Error('Room not found. Check the code or create a new meeting.');
  }
  return room;
}
```

---

**File:** `backend/src/services/livekit.service.ts`

LiveKit is a WebRTC server that handles real-time video/audio streaming.

```typescript
export class LivekitService {
  // Generate JWT token for participant to join room
  public async generateToken(
    roomName: string,
    participantName: string,
    isHost: boolean = false
  ): Promise<string> {
    const config = getLivekitConfig();
    const at = new AccessToken(config.apiKey, config.apiSecret, {
      identity: participantName,
      name: participantName,
    });

    // Embed metadata in token (isHost flag)
    at.metadata = JSON.stringify({ isHost });

    // Grant permissions
    at.addGrant({
      roomJoin: true,              // Can join the room
      room: roomName,              // Which room
      canPublish: true,            // Can publish video/audio
      canSubscribe: true,          // Can subscribe to others' streams
      canPublishData: true,        // Can send data messages
    });

    // Return signed JWT
    return await at.toJwt();
  }

  // Create a new room in LiveKit
  public async createRoom(roomName: string) {
    const roomService = getRoomService();
    const room = await roomService.createRoom({
      name: roomName,
      emptyTimeout: 10 * 60,      // Auto-delete after 10 min of inactivity
      maxParticipants: 50,        // Max 50 users per room
    });
    return room;
  }

  // List all active rooms
  public async listRooms() {
    const roomService = getRoomService();
    return await roomService.listRooms();
  }
}
```

**How LiveKit Works:**
1. User gets a signed JWT token from your backend
2. User connects to LiveKit with token + room name
3. LiveKit server handles real-time WebRTC connections
4. All video/audio is peer-to-peer (not routed through your server)

---

**File:** `backend/src/services/recording.service.ts`

```typescript
// Merge recorded chunks and upload to S3
export const processRecording = async (
  recordingId: string,
  roomId: string,
  meetingId: string,
  totalChunks: number,
  email: string
) => {
  try {
    // 1. Mark as processing
    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: 'processing' },
    });

    console.log(`Processing ${totalChunks} chunks for meeting ${meetingId}`);

    // 2. Merge all chunks into single file
    const mergedFilePath = await mergeChunks(meetingId, totalChunks);
    
    if (!fs.existsSync(mergedFilePath)) {
      throw new Error('Merged file was not created');
    }

    const stats = fs.statSync(mergedFilePath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`Merged video: ${fileSizeMB} MB`);

    // 3. Upload to AWS S3
    const s3Key = `meeting-recordings/${roomId}/${meetingId}.webm`;
    await uploadFileToS3(mergedFilePath, s3Key);
    console.log(`Uploaded to S3: ${s3Key}`);

    // 4. Generate signed URL (expires in 24 hours)
    const signedUrl = await generateSignedUrl(s3Key, 24 * 60 * 60);

    // 5. Update database
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: 'completed',
        fileSize: stats.size,
        s3Key: s3Key,
        downloadExpiresAt: fiveDaysFromNow,
      },
    });

    // 6. Send email notification
    if (email) {
      try {
        await sendRecordingReadyEmail(email, roomId, signedUrl);
        console.log(`Email sent to ${email}`);
      } catch (e) {
        console.warn(`Email failed (non-blocking)`);
      }
    }

    // 7. Cleanup temporary files
    fs.rmSync(path.join(CHUNKS_DIR, meetingId), { recursive: true, force: true });
    fs.rmSync(mergedFilePath, { force: true });

  } catch (error: any) {
    console.error(`FATAL ERROR:`, error.message);
    
    // Mark as failed in database
    await prisma.recording.update({
      where: { id: recordingId },
      data: { 
        status: 'failed',
        failureReason: error.message
      },
    });
  }
};

// Merge chunks from temporary files
const mergeChunks = async (meetingId: string, totalChunks: number): Promise<string> => {
  const mergedFilePath = path.join(MERGED_DIR, `${meetingId}.webm`);
  const writeStream = fs.createWriteStream(mergedFilePath);

  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(CHUNKS_DIR, meetingId, `${i}.webm`);
      if (fs.existsSync(chunkPath)) {
        console.log(`Merging chunk ${i}...`);
        const readStream = fs.createReadStream(chunkPath);
        
        for await (const chunk of readStream) {
          if (!writeStream.write(chunk)) {
            await new Promise<void>(resolve => writeStream.once('drain', resolve));
          }
        }
      }
    }
  } finally {
    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  return mergedFilePath;
};
```

**Recording Flow:**
```
1. User clicks "Record" button
   → Frontend calls startRecording()
   
2. startRecording() calls /api/recording/start
   → Backend creates Recording entry with status='recording'
   → Returns recordingId and meetingId
   
3. While recording, every 5 seconds:
   → Frontend captures a 5-second chunk
   → Uploads chunk to /api/recording/upload-chunk
   → Backend saves chunk to temp disk
   
4. User clicks "Stop" button
   → Frontend calls finishRecording()
   → finishRecording() calls /api/recording/finish
   → Backend processes asynchronously:
      a) Merges all chunks into single file
      b) Uploads merged file to S3
      c) Generates signed URL
      d) Sends email with download link
      e) Updates database with completion status
      f) Deletes temporary chunk files
```

---

**File:** `backend/src/services/s3.service.ts`

AWS S3 stores the final recorded videos.

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.DEV_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.DEV_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.DEV_AWS_SECRET_ACCESS_KEY,
  },
});

// Upload file to S3
export const uploadFileToS3 = async (
  localFilePath: string,
  s3Key: string
): Promise<string> => {
  const fileStream = fs.createReadStream(localFilePath);

  const uploadParams = {
    Bucket: process.env.DEV_AWS_BUCKET_NAME,
    Key: s3Key,                    // e.g., "meeting-recordings/room1/uuid.webm"
    Body: fileStream,
    ContentType: 'video/webm',
  };

  console.log(`Uploading to S3: ${s3Key}`);
  await s3Client.send(new PutObjectCommand(uploadParams));
  console.log(`Upload successful`);
  
  return s3Key;
};

// Generate temporary download URL
export const generateSignedUrl = async (
  s3Key: string,
  expiresInSeconds: number = 24 * 60 * 60  // 24 hours default
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: process.env.DEV_AWS_BUCKET_NAME,
    Key: s3Key,
  });

  // Creates a URL valid for specified duration
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};
```

**Signed URLs:**
- Temporary links for downloading from S3
- Expire after set time (default 24 hours)
- Don't require AWS credentials
- Can be shared or sent via email

---

**File:** `backend/src/services/email.service.ts`

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendRecordingReadyEmail = async (
  toEmail: string,
  roomName: string,
  recordingLink: string
) => {
  try {
    const response = await resend.emails.send({
      from: "Video Conference <onboarding@resend.dev>",
      to: toEmail,
      subject: `Your recording for ${roomName} is ready`,
      html: `
        <h2>Your meeting recording is ready!</h2>
        <p>The recording for room <strong>${roomName}</strong> has been processed.</p>
        <a href="${recordingLink}" 
           style="display:inline-block;padding:10px 20px;background:#007bff;color:white;text-decoration:none;border-radius:5px;">
          Download Recording
        </a>
        <p>Link expires in 24 hours.</p>
      `,
    });

    console.log("Email sent successfully");
    return true;
  } catch (error) {
    console.error("Email failed:", error);
    return false;
  }
};

export const sendPasswordResetEmail = async (toEmail: string, resetLink: string) => {
  try {
    const response = await resend.emails.send({
      from: "Video Conference <onboarding@resend.dev>",
      to: toEmail,
      subject: "Password Reset Request",
      html: `
        <h2>Reset Your Password</h2>
        <p>Click below to reset your password. This link expires in 15 minutes.</p>
        <a href="${resetLink}" 
           style="display:inline-block;padding:10px 20px;background:#c16d18;color:white;text-decoration:none;border-radius:5px;font-weight:bold;">
          Reset Password
        </a>
      `,
    });
    return true;
  } catch (error) {
    console.error("Email error:", error);
    return false;
  }
};
```

---

### Layer 4: Database (Prisma)

All database queries go through Prisma ORM, which provides type-safe operations.

**Prisma Benefits:**
- Type-safe database queries
- Automatic migrations
- Query builder prevents SQL injection
- Schema validation

**Common Prisma Patterns:**

```typescript
// CREATE
const user = await prisma.user.create({
  data: { email, password, name }
});

// READ
const user = await prisma.user.findUnique({ where: { id } });
const users = await prisma.user.findMany();

// UPDATE
const user = await prisma.user.update({
  where: { id },
  data: { name: "New Name" }
});

// DELETE
await prisma.user.delete({ where: { id } });

// UPSERT (update if exists, else create)
const user = await prisma.user.upsert({
  where: { email },
  update: { name },
  create: { email, name }
});
```

---

## Frontend Implementation

### Directory Structure

```
frontend/
├── package.json
├── next.config.ts              // Next.js configuration
├── tsconfig.json               // TypeScript config
├── tailwind.config.ts          // Tailwind CSS config
│
├── public/                     // Static assets
│   └── logo_betel.png
│
└── src/
    ├── app/                    // App Router (Next.js 13+)
    │   ├── layout.tsx          // Root layout
    │   ├── page.tsx            // Home page (/)
    │   ├── login/
    │   │   └── page.tsx        // Login page (/login)
    │   ├── signup/
    │   │   └── page.tsx        // Sign up page (/signup)
    │   ├── meetings/
    │   │   └── page.tsx        // My meetings (/meetings)
    │   ├── profile/
    │   │   └── page.tsx        // User profile (/profile)
    │   ├── recordings/
    │   │   └── [recordingId]/
    │   │       └── page.tsx    // Recording playback (/recordings/id)
    │   ├── reset-password/
    │   │   └── page.tsx        // Reset password (/reset-password)
    │   ├── room/
    │   │   └── [id]/
    │   │       └── page.tsx    // Video room (/room/roomid)
    │   └── globals.css         // Global styles
    │
    ├── components/             // Reusable components
    │   ├── AudioToggleButton.tsx
    │   ├── VideoToggleButton.tsx
    │   ├── ScreenShareButton.tsx
    │   ├── RecordingControls.tsx
    │   ├── RecordingCountdown.tsx
    │   ├── MeetingControls.tsx
    │   ├── ParticipantGrid.tsx
    │   ├── RoomHeader.tsx
    │   ├── RoomJoinGate.tsx
    │   ├── CreateRoomModal.tsx
    │   └── ShareRoomButton.tsx
    │
    ├── contexts/               // React Context for state
    │   └── RoomPinContext.tsx
    │
    ├── hooks/                  // Custom React hooks
    │   └── useRecording.ts
    │
    └── lib/                    // Utilities and API client
        ├── api.ts              // All API calls to backend
        ├── auth.tsx            // Auth context provider
        ├── auth.ts             // Auth utilities
        ├── roomAccess.ts       // Room password storage
        ├── utils.ts            // Helper functions
```

### Entry Point: `frontend/src/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "BetelMeet - Video Conferencing",
  description: "Secure video conferencing and screen recording",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Auth context wraps entire app for user state */}
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
```

**Key Pattern:**
- `<AuthProvider>` wraps all pages → provides `useAuth()` hook everywhere
- All children can access authenticated user state

---

### How Next.js App Router Works

**File-based routing:**
```
src/app/page.tsx              → GET /
src/app/login/page.tsx        → GET /login
src/app/room/[id]/page.tsx    → GET /room/123 (dynamic)
src/app/recordings/[recordingId]/page.tsx → GET /recordings/abc
```

**Dynamic Routes:**
```typescript
// File: src/app/room/[id]/page.tsx
export default function RoomPage({ params }: { params: { id: string } }) {
  const roomId = params.id;  // Access from URL
  // ...
}
```

---

### Page-by-Page Walkthrough

#### 1. Home Page: `frontend/src/app/page.tsx`

```typescript
"use client";  // Client component (uses hooks, state, browser APIs)

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { parseRoomInput } from "@/lib/roomAccess";
import { CreateRoomModal } from "@/components/CreateRoomModal";

export default function HomePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();  // Get auth state
  
  const [roomCode, setRoomCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);

  // Get name from logged-in user or guest input
  const getDisplayName = () => user?.name || guestName;

  // Create new room
  const handleCreateRoom = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    const randomCode = Math.random().toString(36).substring(2, 11);
    setPendingRoomId(randomCode);  // Show modal to set password
  };

  // Join existing room
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = getDisplayName();
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    const parsed = parseRoomInput(roomCode);  // Support room code or full URL
    if (!parsed) {
      setError("Invalid room code");
      return;
    }
    router.push(`/room/${encodeURIComponent(parsed)}?name=${encodeURIComponent(name)}`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#FBF9FA] flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between h-16 px-8 bg-white/80">
        <div className="flex items-center">
          <Image src="/logo_betel.png" alt="Logo" width={160} height={40} />
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/meetings" className="font-semibold">Meetings</Link>
              <Link href="/profile" className="font-semibold">Profile</Link>
              <button onClick={() => logout()}>Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="font-semibold">Login</Link>
              <Link href="/signup" className="font-semibold">Sign Up</Link>
            </>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          {user ? (
            <>
              <h1>Welcome, {user.name}!</h1>
              <button onClick={handleCreateRoom} className="w-full btn btn-primary">
                Create Meeting
              </button>
            </>
          ) : (
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <input
                type="text"
                placeholder="Your name (guest)"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </form>
          )}

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <input
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
            />
            <button type="submit" className="w-full btn btn-primary">
              Join Meeting
            </button>
          </form>

          {error && <div className="text-red-500">{error}</div>}
        </div>
      </main>

      {/* Create Room Modal */}
      {pendingRoomId && (
        <CreateRoomModal
          roomId={pendingRoomId}
          onCreated={(roomId) => {
            setPendingRoomId(null);
            router.push(`/room/${roomId}?name=${encodeURIComponent(user.name)}`);
          }}
          onClosed={() => setPendingRoomId(null)}
        />
      )}
    </div>
  );
}
```

**What happens:**
1. Load page → Check if user is logged in via `useAuth()`
2. Display navbar with user options or login links
3. User can create new room or join existing room
4. Form validates input and navigates to room page

---

#### 2. Login Page: `frontend/src/app/login/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiLogin, apiForgotPassword } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();  // Refresh user state after login
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (isForgotPassword) {
      // Send password reset email
      try {
        const msg = await apiForgotPassword(email);
        setSuccess(msg);
      } catch (err: any) {
        setError(err.message || "Failed");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Login
    try {
      await apiLogin(email, password);  // Save token to localStorage
      await refresh();                  // Fetch user from /api/auth/me
      router.push("/");                 // Redirect home
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9FA] flex items-center justify-center">
      <div className="bg-white border border-stone-200/80 rounded-2xl p-8 shadow-xl max-w-md w-full">
        <h1 className="text-2xl font-bold mb-8">Welcome back</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#c16d18]/15"
            />
          </div>

          {!isForgotPassword && (
            <div>
              <label className="block text-sm font-semibold mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-xs font-bold text-[#c16d18] hover:underline mt-2"
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-600 p-3 rounded-xl text-sm">{success}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#c16d18] hover:bg-[#a0560e] text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-stone-600">Don't have an account? <Link href="/signup" className="text-[#c16d18] font-bold">Sign up</Link></p>
        </div>
      </div>
    </div>
  );
}
```

**Flow:**
1. User enters email and password
2. Click "Login" → Call `apiLogin(email, password)`
3. Backend returns JWT token → Frontend saves to localStorage
4. Call `refresh()` → Fetch user from `/api/auth/me`
5. Update auth context → All pages see logged-in user
6. Redirect to home page

---

#### 3. Video Room: `frontend/src/app/room/[id]/page.tsx`

This is the main video conferencing page.

```typescript
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useRoomContext,
} from "@livekit/components-react";
import { RoomHeader } from "@/components/RoomHeader";
import { ParticipantGrid } from "@/components/ParticipantGrid";
import { MeetingControls } from "@/components/MeetingControls";
import { RecordingCountdown } from "@/components/RecordingCountdown";
import { RoomJoinGate } from "@/components/RoomJoinGate";
import { RoomPinProvider } from "@/contexts/RoomPinContext";

export default function RoomPage() {
  const params = useParams();
  const roomName = decodeURIComponent(params.id as string);
  const searchParams = useSearchParams();
  const router = useRouter();

  const nameFromQuery = searchParams.get("name") || "";
  const [participantName, setParticipantName] = useState(nameFromQuery);
  const [accessPassword, setAccessPassword] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [storageChecked, setStorageChecked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Check if password is already stored (from previous visit)
  useEffect(() => {
    const stored = getStoredRoomPassword(roomName);
    if (stored) setAccessPassword(stored);
    setStorageChecked(true);
  }, [roomName]);

  // Generate LiveKit token if have password and name
  useEffect(() => {
    if (!accessPassword || token) return;
    if (!participantName.trim()) return;

    let cancelled = false;

    const connect = async () => {
      try {
        const t = await getToken(roomName, participantName.trim(), accessPassword);
        if (!cancelled) {
          setToken(t);
          // Update URL with name
          const url = new URL(window.location.href);
          url.searchParams.set("name", participantName.trim());
          router.replace(url.pathname + url.search, { scroll: false });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          // Wrong password
          clearRoomPassword(roomName);
          setAccessPassword(null);
          setError(e instanceof Error ? e.message : "Failed to join the room");
        }
      }
    };

    connect();
    return () => { cancelled = true; };
  }, [accessPassword, token, roomName, participantName, router]);

  const handleVerified = (password: string) => {
    setError("");
    setAccessPassword(password);
  };

  // Show password gate if no password yet
  if (!storageChecked) {
    return <LoadingScreen />;
  }

  if (!accessPassword) {
    return (
      <RoomJoinGate
        roomId={roomName}
        participantName={participantName}
        onNameChange={setParticipantName}
        onVerified={handleVerified}
        initialPassword=""
      />
    );
  }

  // Show error state
  if (error && !token) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FBF9FA]">
        <div className="text-center p-8 bg-white border border-stone-200/80 rounded-2xl shadow-xl">
          <p className="text-red-600 mb-4 font-semibold">{error}</p>
          <button onClick={() => router.push("/")} className="text-[#c16d18] font-bold">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Wait for token
  if (!token) {
    return <LoadingScreen />;
  }

  // Main video room
  return (
    <div className="h-screen w-screen bg-[#FBF9FA] overflow-hidden relative">
      <LiveKitRoom
        video={false}
        audio={false}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        className="h-full w-full relative"
        onDisconnected={() => {
          setError("Disconnected from meeting");
          setToken("");
        }}
      >
        <RoomPinProvider>
          {/* Video grid */}
          <div className="h-full w-full relative z-0 pt-16 md:pt-20 pb-24 md:pb-28">
            <ParticipantGrid />
          </div>

          {/* Overlays */}
          <div className="absolute inset-0 pointer-events-none z-50">
            {/* Header with room ID and participants */}
            <div className="absolute top-0 left-0 right-0 h-16 pointer-events-auto">
              <RoomHeader roomName={roomName} />
            </div>

            {/* Controls at bottom */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-auto px-4">
              <MeetingControls 
                roomName={roomName} 
                onRecordingStateChange={(isRecording, duration) => {
                  setIsRecording(isRecording);
                  setRecordingDuration(duration);
                }}
              />
            </div>

            {/* Recording countdown */}
            <RecordingCountdown recordingDuration={recordingDuration} isRecording={isRecording} />
          </div>
        </RoomPinProvider>

        <RoomAudioRenderer />
        <StartAudio />
      </LiveKitRoom>
    </div>
  );
}
```

**Key Points:**
- `[id]` dynamic route parameter → room code from URL
- `useSearchParams()` → get name from query string
- Check stored password in localStorage (don't ask twice)
- Call `getToken()` to get LiveKit JWT from backend
- Use `<LiveKitRoom>` component from livekit-react library
- Render video grid, header, controls, and countdown

---

### API Client: `frontend/src/lib/api.ts`

This file contains all backend API calls.

```typescript
const getApiBase = () => {
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  if (url.endsWith('/')) url = url.slice(0, -1);
  if (url.endsWith('/api')) url = url.slice(0, -4);
  return url;
};

const API_ROOT = getApiBase();
const API_BASE = `${API_ROOT}/api`;
const AUTH_URL = `${API_BASE}/auth`;
const ROOMS_URL = `${API_BASE}/rooms`;
const RECORDINGS_URL = `${API_BASE}/recording`;

// Helper to add Authorization header if token exists
const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
  const headers: Record<string, string> = { ...extraHeaders };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// ========== AUTH APIS ==========

export async function apiRegister(email: string, password: string, name: string) {
  const response = await fetch(`${AUTH_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, name }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Registration failed');
  
  // Save token
  localStorage.setItem('auth_token', data.token);
  return data;
}

export async function apiLogin(email: string, password: string) {
  const response = await fetch(`${AUTH_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Login failed');
  
  localStorage.setItem('auth_token', data.token);
  return data;
}

export async function apiGetMe() {
  const response = await fetch(`${AUTH_URL}/me`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) return null;
  return await response.json();
}

export async function apiLogout() {
  localStorage.removeItem('auth_token');
  await fetch(`${AUTH_URL}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

// ========== ROOM APIS ==========

export async function createProtectedRoom(roomId: string, password: string) {
  const response = await fetch(`${ROOMS_URL}/create-protected`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ roomId, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to create room');
  return data.room;
}

export async function verifyRoomPassword(roomId: string, password: string) {
  const response = await fetch(`${ROOMS_URL}/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ roomId, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Incorrect password');
  return true;
}

export async function getToken(roomName: string, participantName: string, password: string) {
  const response = await fetch(`${ROOMS_URL}/token`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ roomName, participantName, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to join room');
  return data.token;  // LiveKit JWT token
}

// ========== RECORDING APIS ==========

export async function startRecording(roomId: string, userName: string) {
  const response = await fetch(`${RECORDINGS_URL}/start`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ roomId, createdBy: userName }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to start recording');
  return data;  // { recordingId, meetingId }
}

export async function uploadChunk(blob: Blob, meetingId: string, chunkIndex: number) {
  const formData = new FormData();
  formData.append('chunk', blob);
  formData.append('meetingId', meetingId);
  formData.append('chunkIndex', chunkIndex.toString());

  const response = await fetch(`${RECORDINGS_URL}/upload-chunk`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Chunk upload failed');
  return await response.json();
}

export async function finishRecording(
  recordingId: string,
  roomId: string,
  meetingId: string,
  totalChunks: number,
  email: string
) {
  const response = await fetch(`${RECORDINGS_URL}/finish`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ recordingId, roomId, meetingId, totalChunks, email }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to finish recording');
  return data;
}
```

**Patterns:**
- All endpoints use `credentials: 'include'` for cookies
- Token is sent in `Authorization: Bearer <token>` header
- Errors throw exceptions with user-friendly messages
- GET requests often come from components, POST from handlers

---

### Auth Context: `frontend/src/lib/auth.tsx`

```typescript
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiGetMe, apiLogout } from "./api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

// Wrap entire app with this provider
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user from backend
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const me = await apiGetMe();
      setUser(me);
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  // On mount, check if user is already logged in
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Logout function
  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// Use this hook in any component to get auth state
export function useAuth() {
  return useContext(AuthContext);
}
```

**How it works:**
1. Wrap entire app with `<AuthProvider>`
2. On page load, calls `refresh()` → fetches `/api/auth/me`
3. All components can use `const { user, loading, logout } = useAuth()`
4. When user logs out, `user` is set to null
5. When user logs in, call `refresh()` to update

---

### Key Components

#### RecordingControls Component

```typescript
"use client";

import { useState, useEffect } from "react";
import { Circle, Square, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useRecording } from "@/hooks/useRecording";
import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";

interface RecordingControlsProps {
  roomName: string;
  userEmail?: string;
  userName?: string;
  onRecordStart?: () => void;
  onRecordingStateChange?: (isRecording: boolean, duration: number) => void;
}

export function RecordingControls({ 
  roomName, 
  userEmail, 
  userName, 
  onRecordStart,
  onRecordingStateChange 
}: RecordingControlsProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [recordAudio, setRecordAudio] = useState(true);

  // Get all audio tracks in room
  const audioTracks = useTracks([Track.Source.Microphone, Track.Source.ScreenShareAudio]);

  // Setup recording hook
  const localRecorder = useRecording({
    roomName,
    userEmail: userEmail || 'user@example.com',
    userName: userName || 'Local User',
    onSuccess: (path) => {
      setToastMessage("Recording saved successfully!");
      setShowToast(true);
    },
    onError: (err) => {
      setToastMessage(err);
      setShowToast(true);
    },
  });

  // Notify parent of recording state changes
  useEffect(() => {
    onRecordingStateChange?.(localRecorder.isRecording, localRecorder.duration);
  }, [localRecorder.isRecording, localRecorder.duration, onRecordingStateChange]);

  // Toggle recording on/off
  const toggleLocalRecording = () => {
    if (localRecorder.isRecording) {
      localRecorder.stopRecording();
    } else {
      // Collect audio tracks
      let mediaStreamTracks: MediaStreamTrack[] = [];
      if (recordAudio) {
        mediaStreamTracks = audioTracks
          .map(t => t.publication?.track?.mediaStreamTrack)
          .filter((t): t is MediaStreamTrack => t !== undefined);
      }
      
      localRecorder.startRecording(mediaStreamTracks);
      setToastMessage("Recording started!");
      setShowToast(true);
      onRecordStart?.();
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Toast Notification */}
      {showToast && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl shadow-xl">
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Recording Timer Badge */}
      {localRecorder.isRecording && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white border border-stone-200 shadow-md px-3 py-1 rounded-full">
          <div className="w-2 h-2 rounded-full bg-[#c16d18] animate-pulse" />
          <span className="text-xs font-mono text-[#c16d18] font-extrabold">
            {formatDuration(localRecorder.duration)}
          </span>
        </div>
      )}

      {/* Record Button */}
      <button
        onClick={toggleLocalRecording}
        className={`h-10 w-10 md:h-12 md:w-12 rounded-l-2xl flex items-center justify-center transition-all ${
          localRecorder.isRecording
            ? "bg-[#c16d18] hover:bg-[#a0560e] text-white animate-pulse"
            : "bg-white hover:bg-stone-50 text-[#c16d18] border-stone-200"
        }`}
      >
        {localRecorder.isRecording ? (
          <Square size={16} className="fill-current" />
        ) : (
          <Circle size={16} className="fill-current" />
        )}
      </button>

      {/* Audio toggle menu */}
      {/* ... */}
    </div>
  );
}
```

**What it does:**
1. Get audio tracks from LiveKit room
2. On "Record" click: Start MediaRecorder with those tracks
3. Every 5 seconds, upload a chunk to backend
4. Display timer and toast notifications
5. Call parent callback to update countdown timer

---

#### MeetingControls Component

```typescript
"use client";

import React from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { PhoneOff } from "lucide-react";
import { AudioToggleButton } from "./AudioToggleButton";
import { VideoToggleButton } from "./VideoToggleButton";
import { ScreenShareButton } from "./ScreenShareButton";
import { RecordingControls } from "./RecordingControls";
import { useRouter } from "next/navigation";

interface MeetingControlsProps {
  roomName: string;
  onRecordingStateChange?: (isRecording: boolean, duration: number) => void;
}

export function MeetingControls({ roomName, onRecordingStateChange }: MeetingControlsProps) {
  const room = useRoomContext();
  const router = useRouter();
  const { localParticipant } = useLocalParticipant();
  const [showLeaveConfirm, setShowLeaveConfirm] = React.useState(false);

  // Check if user is host (from metadata)
  const isHost = React.useMemo(() => {
    if (!localParticipant?.metadata) return false;
    try {
      const meta = JSON.parse(localParticipant.metadata);
      return meta.isHost === true;
    } catch {
      return false;
    }
  }, [localParticipant?.metadata]);

  // Handle leave meeting
  const handleLeave = async () => {
    try {
      if (isHost) {
        // End meeting for all participants
        try {
          await apiEndMeeting(roomName);
        } catch (e) {
          console.warn("API end failed");
        }

        // Broadcast signal to participants
        if (room?.localParticipant) {
          const encoder = new TextEncoder();
          const data = encoder.encode(JSON.stringify({ type: 'MEETING_ENDED' }));
          await room.localParticipant.publishData(data, { reliable: true });
        }

        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      if (room?.state !== "disconnected") {
        await room?.disconnect(true);
      }
    } finally {
      router.push("/");
    }
  };

  return (
    <div className="relative flex items-center gap-3 bg-white/95 border border-stone-200/80 p-3 rounded-3xl shadow-xl">
      {/* Mute Button */}
      <AudioToggleButton />

      {/* Video Button */}
      <VideoToggleButton />

      {/* Screen Share Button */}
      <ScreenShareButton />

      {/* Recording Button (Host only) */}
      {isHost && (
        <RecordingControls 
          roomName={roomName} 
          onRecordingStateChange={onRecordingStateChange}
        />
      )}

      {/* Leave Button */}
      <button
        onClick={() => setShowLeaveConfirm(true)}
        className="h-10 w-14 md:h-12 md:w-20 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-all"
      >
        <PhoneOff size={20} />
      </button>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold mb-2">
              {isHost ? "End meeting?" : "Leave meeting?"}
            </h3>
            <p className="text-sm text-stone-500 mb-6">
              {isHost
                ? "You are the host. Leaving will end the meeting for all participants."
                : "Are you sure you want to exit this meeting?"}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLeaveConfirm(false);
                  handleLeave();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white"
              >
                {isHost ? "End Meeting" : "Yes, Leave"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**What it does:**
1. Render mute, video, screen share, record, and leave buttons
2. Get host status from participant metadata
3. Show record button only to host
4. Confirm before leaving
5. If host leaves, notify all participants and end room

---

#### ParticipantGrid Component

```typescript
"use client";

import { Participant, Track } from "livekit-client";
import {
  GridLayout,
  ParticipantTile,
  useParticipants,
} from "@livekit/components-react";
import { VideoTile } from "./VideoTile";

export function ParticipantGrid() {
  // Get all participants in room
  const participants = useParticipants();

  return (
    <GridLayout tracks={participants.map((p) => p.videoTrack)} >
      {participants.map((participant) => (
        <ParticipantTile key={participant.identity} participant={participant}>
          <VideoTile participant={participant} />
        </ParticipantTile>
      ))}
    </GridLayout>
  );
}
```

**What it does:**
1. Get all participants from LiveKit room
2. Render video tiles in grid layout
3. Each tile shows participant's camera feed
4. Automatically rearranges when participants join/leave

---

## Features & How They Work

### Feature 1: User Authentication

**Files Involved:**
- Backend: `auth.controller.ts`, `auth.routes.ts`
- Frontend: `api.ts`, `auth.tsx`, `login/page.tsx`, `signup/page.tsx`

**Sign Up Flow:**
```
1. User fills registration form
   ↓
2. Frontend calls POST /api/auth/register with { email, password, name }
   ↓
3. Backend:
   a) Check if email already exists in database
   b) Hash password with bcrypt (10 rounds)
   c) Create User record in PostgreSQL
   d) Generate JWT token (expires 7 days)
   e) Set HTTP-only cookie
   f) Return token + user
   ↓
4. Frontend:
   a) Save token to localStorage
   b) Call refresh() to fetch user from /api/auth/me
   c) Redirect to home page
   ↓
5. All subsequent requests include token in Authorization header
```

**Password Security:**
- Passwords are hashed with bcrypt before storing
- Plaintext passwords never stored or logged
- JWT tokens used instead of storing password

---

### Feature 2: Room Creation & Joining

**Files Involved:**
- Backend: `room.controller.ts`, `room.service.ts`, `livekit.service.ts`
- Frontend: `lib/api.ts`, `page.tsx`, `room/[id]/page.tsx`

**Create Room Flow:**
```
1. User clicks "Create Meeting" on home page
   ↓
2. Generate random room code (e.g., "abc123xyz")
   ↓
3. Show modal to set password
   ↓
4. Frontend calls POST /api/rooms/create-protected with { roomId, password }
   ↓
5. Backend:
   a) Validate roomId format (3-64 chars, alphanumeric/dash/underscore)
   b) Check if room already exists
   c) Hash password with bcrypt
   d) Create Room record in PostgreSQL
   e) Call LiveKit API to create room
   f) Return room details
   ↓
6. Frontend redirects to /room/abc123xyz
```

**Join Room Flow:**
```
1. User enters room code and name
   ↓
2. Frontend calls POST /api/rooms/verify-password with { roomId, password }
   ↓
3. Backend:
   a) Find room in database
   b) Compare password with hash
   c) Return verified=true or error
   ↓
4. If password correct:
   a) Frontend calls POST /api/rooms/token with { roomName, participantName, password }
   b) Backend generates LiveKit JWT token
   c) Returns token to frontend
   ↓
5. Frontend connects to LiveKit using token
   ↓
6. LiveKit establishes peer-to-peer WebRTC connections
```

---

### Feature 3: Video Conferencing

**Files Involved:**
- Frontend: `room/[id]/page.tsx`, `components/ParticipantGrid.tsx`, `components/MeetingControls.tsx`
- Backend: `livekit.service.ts`
- External: LiveKit Cloud

**How it Works:**
```
Frontend                          LiveKit Server                   Other Participants
   │                                   │                                   │
   ├─ Connect with JWT token ────────→ │                                   │
   │                                   │                                   │
   │ Get participant list ←──────────── │                                   │
   │                                   │                                   │
   ├─ Publish video/audio ────────────→ │ ──── SFU (Selective Forwarding) ──→
   │                                   │                                   │
   │ Subscribe to remote streams ←─────│◄─── (Receive their video/audio) ──│
   │                                   │                                   │
```

**Real-time Features:**
- **Video Tiles**: Display participant cameras in grid
- **Audio Toggle**: Mute/unmute microphone via LiveKit track toggle
- **Video Toggle**: Turn camera on/off
- **Screen Share**: Share entire screen for presentations
- **Participant List**: See who's in the meeting
- **Data Channel**: Send real-time messages between participants

---

### Feature 4: Screen Recording

**Files Involved:**
- Frontend: `hooks/useRecording.ts`, `components/RecordingControls.tsx`
- Backend: `recording.controller.ts`, `recording.service.ts`, `s3.service.ts`, `email.service.ts`

**Recording Flow (5 Stages):**

**Stage 1: Start Recording**
```
1. User clicks "Record" button
   ↓
2. Frontend requests screen capture:
   navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
   ↓
3. Browser shows "Select screen to share" dialog
   ↓
4. User selects screen/window
   ↓
5. Frontend gets stream and starts MediaRecorder
   ↓
6. Frontend calls POST /api/recording/start
   ↓
7. Backend creates Recording entry with status='recording'
   ↓
8. Toast: "Recording started!"
```

**Stage 2: Chunk Upload (Every 5 seconds)**
```
1. MediaRecorder produces 5-second chunk of video
   ↓
2. Frontend extracts Blob from chunk
   ↓
3. Frontend calls POST /api/recording/upload-chunk with:
   - chunk (blob)
   - meetingId
   - chunkIndex (0, 1, 2, ...)
   ↓
4. Backend saves chunk to /tmp/video-app-chunks/{meetingId}/{index}.webm
   ↓
5. Repeat until user stops recording
```

**Stage 3: Finish Recording**
```
1. User clicks "Stop" button
   ↓
2. Frontend calls POST /api/recording/finish with:
   - recordingId
   - roomId
   - meetingId
   - totalChunks
   - email
   ↓
3. Backend immediately returns "processing"
   ↓
4. Backend processes asynchronously (doesn't block response)
```

**Stage 4: Processing**
```
1. Merge all chunks into single WebM file:
   - Read chunk 0.webm
   - Append chunk 1.webm
   - Append chunk 2.webm
   - ... until totalChunks
   ↓
2. Output: /tmp/video-app-merged/{meetingId}.webm (final video)
```

**Stage 5: Upload & Finalize**
```
1. Upload merged file to AWS S3:
   s3://bucket/meeting-recordings/{roomId}/{meetingId}.webm
   ↓
2. Generate signed URL (expires 24 hours):
   https://s3.amazonaws.com/bucket/...?Signature=...
   ↓
3. Update database:
   status = 'completed'
   s3Key = 's3://bucket/...'
   fileSize = bytes
   downloadExpiresAt = 5 days from now
   ↓
4. Send email:
   To: admin@example.com
   Subject: Your recording for [roomName] is ready
   Body: Click link to download
   ↓
5. Cleanup temporary files (delete chunks)
```

**Recording Limits:**
- Maximum: 1 hour (3600 seconds)
- Warning: Shows at 50 minutes (3000 seconds)
- 5-minute countdown: Appears when <300 seconds remain
- Auto-stop: Automatically stops at 1 hour

---

### Feature 5: Recording Countdown Timer

**Files Involved:**
- Frontend: `components/RecordingCountdown.tsx`, `room/[id]/page.tsx`
- Backend: `hooks/useRecording.ts`

**How it Works:**
```
1. Recording starts
   ↓
2. Timer counts up: 0, 1, 2, 3, ...
   ↓
3. When duration > (3600 - 300) = 3300 seconds:
   - SHOW countdown: 5:00, 4:59, 4:58, ...
   - Orange badge: "Recording Time Left"
   ↓
4. When duration > 3300 + 120 = 3420 seconds:
   - Badge turns RED
   - Icon pulses instead of bounces
   - User knows time is critical
   ↓
5. When duration >= 3600 seconds:
   - AUTO-STOP recording
   - Warning message shown
```

**Visual States:**
```
Normal (>5 min left)      5 min countdown      <2 min left
─────────────────────────────────────────────────────────
Recording                 🕐 5:00              🕐 1:30
📊 duration                   ↓                   ↓
(hidden)            Recording Time Left   Recording Time Left
                    (orange badge,        (red badge,
                     bouncing icon)       pulsing icon)
```

---

## Deployment

### Local Development

**Backend Setup:**
```bash
# 1. Install dependencies
cd backend
npm install

# 2. Setup environment
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, LIVEKIT keys, etc.

# 3. Run Prisma migrations
npx prisma db push

# 4. Start development server
npm run dev
# Runs on http://localhost:3001
```

**Frontend Setup:**
```bash
cd frontend
npm install

# Create .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880

npm run dev
# Runs on http://localhost:3000
```

**Database Setup (Local):**
```bash
# Install PostgreSQL
# Create database
createdb video_conferencing_db

# Set DATABASE_URL in backend/.env
DATABASE_URL=postgresql://username:password@localhost:5432/video_conferencing_db

# Run migrations
npx prisma db push
```

---

### Production Deployment (Render.com)

**Backend Service:**
1. Connect GitHub repo
2. Set environment variables:
   ```
   NODE_ENV=production
   DATABASE_URL=<postgresql url>
   FRONTEND_URL=https://video-confrencing-frontend.onrender.com
   JWT_SECRET=<strong random string>
   LIVEKIT_API_KEY=<from LiveKit>
   LIVEKIT_API_SECRET=<from LiveKit>
   LIVEKIT_URL=wss://...livekit.cloud
   ```
3. Build command: `npm run build`
4. Start command: `npm start`

**Frontend Service:**
1. Connect GitHub repo
2. Set environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://video-conferencing-app-769z.onrender.com/api
   NEXT_PUBLIC_LIVEKIT_URL=wss://video-confrencing-xgol7pv4.livekit.cloud
   NEXT_PUBLIC_APP_URL=https://video-confrencing-frontend.onrender.com
   ```
3. Build command: `npm run build`
4. Start command: `npm start`

**Database (PostgreSQL):**
- Render provides managed PostgreSQL
- Copy connection string to `DATABASE_URL`

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Framework** | Next.js 16 | Server-side rendering, routing, API calls |
| **Frontend UI** | React 19 | Component-based UI, hooks |
| **Styling** | Tailwind CSS 4 | Utility-first CSS framework |
| **Video SDK** | LiveKit | Real-time WebRTC conferencing |
| **Backend Framework** | Express.js | REST API server |
| **Database** | PostgreSQL | Persistent data storage |
| **ORM** | Prisma 6 | Type-safe database queries |
| **Authentication** | JWT + Bcrypt | Token-based auth + password hashing |
| **Storage** | AWS S3 | Recording file storage |
| **Email** | Resend | Transactional emails |
| **Deployment** | Render.com | Cloud hosting for backend/frontend |
| **CDN/WebRTC** | LiveKit Cloud | Managed WebRTC infrastructure |

---

## Data Flow Diagrams

### Authentication Flow
```
User
  ↓
[Sign Up Form]
  ↓
POST /api/auth/register {email, password, name}
  ↓ (Express)
[AuthController.register]
  ↓
Check if email exists in DB
  ↓
Bcrypt.hash(password) → hashed_password
  ↓
Prisma.user.create({email, hashed_password, name})
  ↓
JWT.sign({id, email, name}) → token
  ↓
Set cookie + return token
  ↓ (Frontend)
localStorage.setItem(token)
  ↓
Call refresh() → fetch /api/auth/me
  ↓
Set user in AuthContext
  ↓
All pages access user via useAuth()
```

### Room Creation Flow
```
Frontend                          Backend                   Databases
   │                                │                          │
   ├─ User clicks "Create" ────────→│                          │
   │                                │                          │
   │                                ├─ Validate roomId ────────│
   │                                │                          │
   │                                ├─ Bcrypt.hash(password) ──│
   │                                │                          │
   │                                ├─ Create Room in DB ──────│
   │                                │                          │
   │                                ├─ Call LiveKit API ───────→ LiveKit
   │                                │  (createRoom)            │
   │                                │                          │
   │◄─ Return roomId ───────────────│                          │
   │                                │                          │
   └─ Redirect to /room/{roomId}
```

### Recording Flow
```
Frontend                          Backend                   Storage
   │                                │                        │
   ├─ User clicks Record ───────────│                        │
   │  getDisplayMedia()             │                        │
   │  ↓                             │                        │
   ├─ Start MediaRecorder           │                        │
   │                                │                        │
   │  Every 5 seconds:              │                        │
   │  ├─ GET 5s chunk ──────────────→ POST /upload-chunk    │
   │  │                             │                        │
   │  │                             ├─ Save to /tmp/... ────→ Disk
   │  │                             │                        │
   │  │◄─ Acknowledge ──────────────│                        │
   │  └─ Repeat                     │                        │
   │                                │                        │
   ├─ User stops recording          │                        │
   │                                │                        │
   ├─ POST /finish ────────────────→│ ASYNC PROCESS:        │
   │                                │                        │
   │◄─ Return (processing) ─────────│                        │
   │                                │                        │
   │                                ├─ Merge chunks ────────→ Disk
   │                                │                        │
   │                                ├─ Upload to S3 ────────→ AWS S3
   │                                │                        │
   │                                ├─ Generate signed URL   │
   │                                │                        │
   │                                ├─ Update DB ───────────│
   │                                │                        │
   │                                ├─ Send email ─────────→ Resend
   │                                │                        │
   │                                └─ Cleanup /tmp
```

---

## Key Concepts to Remember

### 1. JWT Tokens
- Signed tokens containing user ID, email, and name
- Expires after 7 days
- Sent in `Authorization: Bearer <token>` header
- Verified on backend using JWT_SECRET

### 2. Bcrypt Password Hashing
- Passwords hashed 10 rounds before storing
- Can't be reversed to get plaintext
- Comparison uses `bcrypt.compare(plaintext, hash)`

### 3. LiveKit Architecture
- You provide JWT token to client
- Client connects to LiveKit server
- LiveKit handles all WebRTC peer connections
- Video/audio is peer-to-peer, not routed through your backend

### 4. Recording Process
- Frontend captures display stream
- Frontend records locally using MediaRecorder API
- Every 5 seconds, a chunk is uploaded to your backend
- Backend merges chunks into single file after recording stops
- Final file uploaded to S3, deleted from disk

### 5. Database Models
- **User**: Email, name, hashed password
- **Room**: Room code, hashed password, creator ID
- **Recording**: Room ID, meeting ID, S3 location, status, expiration

---

## Common Workflows

### Workflow 1: User Registration
```
1. Go to /signup
2. Enter email, password, name
3. Click "Sign Up"
4. Backend creates user and returns JWT
5. Frontend saves JWT and fetches user profile
6. Redirected to home page
```

### Workflow 2: Create & Host Meeting
```
1. Go to home page (logged in)
2. Click "Create Meeting"
3. Set room code and password
4. Backend creates Room in database
5. Frontend redirects to /room/code
6. Browser shows "Select screen to share"
7. Select screen
8. Now you're in the room, ready to record
```

### Workflow 3: Guest Joins Meeting
```
1. Guest goes to home page (not logged in)
2. Enter guest name and room code
3. Click "Join Meeting"
4. Browser prompts for room password
5. Guest enters password
6. Backend verifies and generates LiveKit token
7. Frontend connects using token
8. Guest sees host's screen and can chat
```

### Workflow 4: Record & Download Meeting
```
1. Host clicks "Record" in meeting
2. Host's screen is recorded locally
3. Host clicks "Stop" to end
4. Frontend uploads all chunks to backend
5. Backend merges and uploads to S3
6. Admin receives email with download link
7. Download link expires after 5 days
```

---

This comprehensive walkthrough covers the entire application from database to frontend. Each layer builds on the previous one to create a fully functional video conferencing platform with recording capabilities.

