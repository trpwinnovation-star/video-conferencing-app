"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { getToken } from "@/lib/api";
import { RoomHeader } from "@/components/RoomHeader";
import { ParticipantGrid } from "@/components/ParticipantGrid";
import { MeetingControls } from "@/components/MeetingControls";
import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";

export default function RoomPage() {
  const params = useParams();
  const roomName = params.id as string;
  const searchParams = useSearchParams();
  const participantName = searchParams.get("name") || "Guest";

  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isSecureContext, setIsSecureContext] = useState(true);

  useEffect(() => {
    // Check if browser allows media access (requires HTTPS or localhost)
    if (typeof window !== "undefined" && !navigator.mediaDevices) {
      setIsSecureContext(false);
      setError("Insecure Origin Detected: Your browser blocks camera access on HTTP. Please enable the 'unsafely-treat-insecure-origin-as-secure' flag in Chrome/Edge for this IP address.");
    }
    
    if (!roomName || !participantName) return;
    
    let mounted = true;
    const fetchToken = async () => {
      try {
        const t = await getToken(roomName, participantName);
        if (mounted) setToken(t);
      } catch (e: any) {
        console.error("Room join error:", e);
        if (mounted) setError(e.message || "Failed to join the room. Please try again.");
      }
    };
    fetchToken();
    
    return () => { mounted = false; };
  }, [roomName, participantName]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FBF9FA] text-stone-900">
        <div className="text-center p-8 bg-white border border-stone-200/80 rounded-2xl shadow-xl max-w-md">
          <p className="text-red-600 mb-4 font-semibold">{error}</p>
          <a href="/" className="text-[#c16d18] hover:underline font-bold">Return to Home</a>
        </div>
      </div>
    );
  }

  if (token === "") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FBF9FA] text-stone-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-[#c16d18]" size={32} />
          <p className="font-bold">Joining room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#FBF9FA] overflow-hidden relative text-stone-900">
      <LiveKitRoom
        video={false}
        audio={false}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880"}
        className="h-full w-full relative"
      >
        {/* Main Video Area */}
        <div className="h-full w-full relative z-0">
           <ParticipantGrid />
        </div>
        
        {/* Floating UI Overlay */}
        <div className="absolute inset-0 pointer-events-none z-50">
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 h-16 pointer-events-auto">
            <RoomHeader roomName={roomName} />
          </div>
          
          {/* Bottom Bar */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-auto px-4">
            <MeetingControls roomName={roomName} />
          </div>
        </div>
        
        <RoomAudioRenderer />
        <StartAudio label="Click to enable audio" />
      </LiveKitRoom>
    </div>
  );
}
