import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";
import roomRoutes from "./src/routes/room.routes";
import authRoutes from "./src/routes/auth.routes";
import recordingRoutes from "./src/routes/recording.routes";
import path from "path";

console.log("Starting server...");
const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, "");
    const allowedOrigins = [
      frontendUrl,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ].filter(Boolean);
    
    // Allow if origin is in list or is undefined (for tools like Postman)
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, "")) || (process.env.NODE_ENV !== 'production' && (origin.endsWith(".ngrok-free.app") || origin.endsWith(".ngrok-free.dev")))) {
      callback(null, true);
    } else {
      console.warn(`CORS REJECTED! Website URL: "${origin}" | Allowed URLs: ${JSON.stringify(allowedOrigins)}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/recordings", recordingRoutes);

// Static files for recordings
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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
