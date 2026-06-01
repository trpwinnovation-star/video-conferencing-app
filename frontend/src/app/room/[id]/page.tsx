"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { getToken } from "@/lib/api";
import { getStoredRoomPassword, clearRoomPassword } from "@/lib/roomAccess";
import { RoomHeader } from "@/components/RoomHeader";
import { ParticipantGrid } from "@/components/ParticipantGrid";
import { MeetingControls } from "@/components/MeetingControls";
import { RoomJoinGate } from "@/components/RoomJoinGate";
import { RoomPinProvider } from "@/contexts/RoomPinContext";
import { Loader2 } from "lucide-react";

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
  const [connecting, setConnecting] = useState(false);
  const [storageChecked, setStorageChecked] = useState(false);

  useEffect(() => {
    const stored = getStoredRoomPassword(roomName);
    if (stored) setAccessPassword(stored);
    setStorageChecked(true);
  }, [roomName]);

  useEffect(() => {
    if (!accessPassword || token) return;
    if (!participantName.trim()) return;

    let cancelled = false;

    const connect = async () => {
      setConnecting(true);
      setError("");
      try {
        const t = await getToken(roomName, participantName.trim(), accessPassword);
        if (!cancelled) {
          if (!t) {
            throw new Error("No token received from server");
          }
          setToken(t);
          const url = new URL(window.location.href);
          url.searchParams.set("name", participantName.trim());
          router.replace(url.pathname + url.search, { scroll: false });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          clearRoomPassword(roomName);
          setAccessPassword(null);
          setError(
            e instanceof Error ? e.message : "Failed to join the room. Please try again."
          );
        }
      } finally {
        if (!cancelled) setConnecting(false);
      }
    };

    connect();
    return () => {
      cancelled = true;
    };
    // Do not include `connecting` or `error` — updating them re-ran this effect and cancelled the token request mid-flight.
  }, [accessPassword, token, roomName, participantName, router]);

  const handleVerified = (password: string) => {
    setError("");
    setAccessPassword(password);
  };

  const handleRetry = () => {
    setError("");
    setToken("");
    setAccessPassword(null);
    clearRoomPassword(roomName);
  };

  if (!storageChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FBF9FA]">
        <Loader2 className="animate-spin text-[#c16d18]" size={32} />
      </div>
    );
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

  if (error && !token) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FBF9FA] text-stone-900">
        <div className="text-center p-8 bg-white border border-stone-200/80 rounded-2xl shadow-xl max-w-md">
          <p className="text-red-600 mb-4 font-semibold">{error}</p>
          <button
            onClick={handleRetry}
            className="text-[#c16d18] hover:underline font-bold mr-4 cursor-pointer"
          >
            Try again
          </button>
          <a href="/" className="text-stone-500 hover:underline font-medium">
            Home
          </a>
        </div>
      </div>
    );
  }

  if (!participantName.trim()) {
    return (
      <RoomJoinGate
        roomId={roomName}
        participantName={participantName}
        onNameChange={setParticipantName}
        onVerified={handleVerified}
        initialPassword={accessPassword}
      />
    );
  }

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FBF9FA] text-stone-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-[#c16d18]" size={32} />
          <p className="font-bold">{connecting ? "Joining room..." : "Preparing to join..."}</p>
        </div>
      </div>
    );
  }

  if (typeof window !== "undefined" && !navigator.mediaDevices) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FBF9FA] text-stone-900">
        <div className="text-center p-8 bg-white border border-stone-200/80 rounded-2xl shadow-xl max-w-md">
          <p className="text-red-600 mb-4 font-semibold">
            Camera access requires HTTPS or localhost.
          </p>
          <a href="/" className="text-[#c16d18] hover:underline font-bold">
            Return to Home
          </a>
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
        onDisconnected={() => {
          setError("The meeting has ended or you were disconnected.");
          setToken("");
        }}
      >
        <RoomPinProvider>
          <div className="h-full w-full relative z-0 pt-16 md:pt-20 pb-24 md:pb-28">
            <ParticipantGrid />
          </div>

          <div className="absolute inset-0 pointer-events-none z-50">
            <div className="absolute top-0 left-0 right-0 h-16 pointer-events-auto">
              <RoomHeader roomName={roomName} />
            </div>

            <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-auto px-4">
              <MeetingControls roomName={roomName} />
            </div>
          </div>
        </RoomPinProvider>

        <RoomAudioRenderer />
        <StartAudio label="Click to enable audio" />
      </LiveKitRoom>
    </div>
  );
}
