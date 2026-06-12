import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import roomRoutes from "./src/routes/room.routes";
import authRoutes from "./src/routes/auth.routes";
import recordingRoutes from "./src/routes/recording.routes";
import { startRecordingAutoCompleter } from "./src/services/recording.service";
import { startScheduledMeetingAutoCompleter } from "./src/services/scheduled-meeting.service";
import egressRoutes from "./src/routes/egress.routes";
import scheduledMeetingRoutes from "./src/routes/scheduled-meeting.routes";
import path from "path";

// ── Guard: fail fast if critical secrets are missing in production ───────────
if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET) {
    console.error(
      "FATAL: JWT_SECRET environment variable is not set. " +
      "Using the default secret in production allows token forgery. " +
      "Set JWT_SECRET to a long random string and restart."
    );
    process.exit(1);
  }
  if (!process.env.LIVEKIT_API_KEY || process.env.LIVEKIT_API_KEY === "devkey") {
    console.error(
      "FATAL: LIVEKIT_API_KEY is not set or is still the development default ('devkey'). " +
      "Set real LiveKit credentials and restart."
    );
    process.exit(1);
  }
}

console.log("Starting server...");
const app = express();
const port = Number(process.env.PORT || 3001);

// Render terminates TLS at the edge; needed for secure cookies behind a proxy
app.set("trust proxy", 1);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.NEXT_PUBLIC_APP_URL,
]
  .filter((o): o is string => Boolean(o))
  .map((o) => o.replace(/\/$/, ""));

if (process.env.NODE_ENV === "production") {
  if (allowedOrigins.length === 0) {
    console.warn(
      "FRONTEND_URL is not set — CORS allows any origin. Set FRONTEND_URL=https://your-frontend-domain.com"
    );
  } else {
    console.log("CORS allowed origins:", allowedOrigins.join(", "));
  }
}

// Only log every request in development — too noisy and exposes headers in prod
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} from ${req.headers.origin}`);
    next();
  });
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== "production") return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, origin);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  // Expose custom headers so the browser can read them in cross-origin fetch()
  exposedHeaders: ["X-Download-Count", "X-Downloads-Remaining"],
}));
app.use(express.json());
app.use(cookieParser());

// ── Rate Limiting ────────────────────────────────────────────────────────────
// Auth endpoints: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
});

// Room token endpoint: 30 attempts per 15 minutes per IP
// (participants reconnect and re-fetch tokens, so needs a higher limit)
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many token requests. Please try again in 15 minutes." },
});

// Room create: 5 rooms per 15 minutes per IP
const createRoomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many rooms created. Please try again in 15 minutes." },
});

// Routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/rooms/token", tokenLimiter);
app.use("/api/rooms/create-protected", createRoomLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/recording", recordingRoutes);
app.use("/api/egress", egressRoutes);
app.use("/api/scheduled-meetings", scheduledMeetingRoutes);

// Static files for recordings
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Backend Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? "Something went wrong" : err.message,
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  startRecordingAutoCompleter();
  startScheduledMeetingAutoCompleter();
});
