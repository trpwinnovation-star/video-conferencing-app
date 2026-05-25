import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";
import roomRoutes from "./src/routes/room.routes";
import authRoutes from "./src/routes/auth.routes";
import recordingRoutes from "./src/routes/recording.routes";
import egressRoutes from "./src/routes/egress.routes";
import path from "path";

console.log("Starting server...");
const app = express();
const port = process.env.PORT || 3001;

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
      "FRONTEND_URL is not set — CORS allows any origin. Set FRONTEND_URL=https://video-confrencing-frontend.onrender.com"
    );
  } else {
    console.log("CORS allowed origins:", allowedOrigins.join(", "));
  }
}

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} from ${req.headers.origin}`);
  next();
});

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
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/recording", recordingRoutes);
app.use("/api/egress", egressRoutes);

// Static files for recordings
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Backend Error:", err);
  res.status(500).json({ 
    error: "Internal Server Error",
    message: process.env.NODE_ENV === 'production' ? "Something went wrong" : err.message
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
