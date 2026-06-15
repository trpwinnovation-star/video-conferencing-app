import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "localhost:3000",
    "127.0.0.1:3000",
    "192.168.1.162",
    "192.168.1.162:3000",
    "192.168.1.173",
    "http://192.168.1.162:3000",
    "192.168.48.1",
    "192.168.48.1:3000",
    "http://192.168.48.1:3000"
  ]
};

export default nextConfig;
