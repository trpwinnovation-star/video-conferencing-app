"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import "@livekit/components-styles";
import { getToken, checkRoomStatus } from "@/lib/api";
import { getStoredRoomPassword, clearRoomPassword } from "@/lib/roomAccess";
import { RoomHeader } from "@/components/RoomHeader";
import { ParticipantGrid } from "@/components/ParticipantGrid";
import { MeetingControls } from "@/components/MeetingControls";
import { RecordingCountdown } from "@/components/RecordingCountdown";
import { RoomJoinGate } from "@/components/RoomJoinGate";
import { RoomPinProvider } from "@/contexts/RoomPinContext";
import { Loader2 } from "lucide-react";

function MeetingEndListener({ onMeetingEnded, roomName }: { onMeetingEnded: () => void; roomName: string }) {
  const room = useRoomContext();

  // Derive isHost from room data without storing in state
  const isHost = (() => {
    if (!room?.localParticipant?.metadata) return false;
    try {
      const meta = JSON.parse(room.localParticipant.metadata);
      return meta.isHost === true;
    } catch {
      return false;
    }
  })();

  // Data channel listener (for when host deliberately ends meeting)
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const str = new TextDecoder().decode(payload);
        const msg = JSON.parse(str);
        if (msg?.type === "MEETING_ENDED") {
          console.log("Received MEETING_ENDED signal from host");
          onMeetingEnded();
          room.disconnect(true);
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, onMeetingEnded]);

  // Room status polling for non-host participants
  // This ensures they're kicked out if the host ends the meeting or the room is deleted
  useEffect(() => {
    if (!room || isHost) return; // Only poll for non-host participants

    let pollInterval: NodeJS.Timeout | null = null;

    const startPolling = async () => {
      // Start polling after 3 seconds (give the meeting time to start)
      await new Promise(resolve => setTimeout(resolve, 3000));

      pollInterval = setInterval(async () => {
        try {
          const status = await checkRoomStatus(roomName);
          if (!status.exists) {
            console.log("Room no longer exists - meeting ended by host");
            onMeetingEnded();
            if (room && room.state !== "disconnected") {
              await room.disconnect(true);
            }
          }
        } catch (error) {
          console.warn("Error polling room status:", error);
        }
      }, 5000); // Poll every 5 seconds
    };

    startPolling();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [room, roomName, isHost, onMeetingEnded]);

  return null;
}

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const handleRecordingStateChange = (isRecording: boolean, duration: number) => {
    setIsRecording(isRecording);
    setRecordingDuration(duration);
  };

  useEffect(() => {
    const storedToken = sessionStorage.getItem(`room_token_${roomName}`);
    if (storedToken) {
      setToken(storedToken);
      sessionStorage.removeItem(`room_token_${roomName}`);
      setStorageChecked(true);
      return;
    }

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

  if (!accessPassword && !token) {
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
    const isRoomFull = error.toLowerCase().includes('room is full');
    return (
      <div className="flex h-screen items-center justify-center bg-[#FBF9FA] text-stone-900">
        <div className="text-center p-8 bg-white border border-stone-200/80 rounded-2xl shadow-xl max-w-md w-full mx-4">
          {isRoomFull ? (
            <>
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                🚫
              </div>
              <h2 className="text-xl font-extrabold text-stone-900 mb-2">Meeting Room Full</h2>
              <p className="text-stone-500 mb-6 text-sm leading-relaxed">
                This meeting has reached its maximum capacity of <strong>5 participants</strong>. 
                Please ask the host to make space or try again later.
              </p>
              <div className="flex items-center justify-center gap-4">
                <a href="/" className="bg-[#c16d18] hover:bg-[#a0560e] text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95">
                  Go Home
                </a>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
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
        initialPassword={accessPassword || ""}
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
          if (sessionStorage.getItem("voluntary_leave")) {
            sessionStorage.removeItem("voluntary_leave");
            router.push("/");
            return;
          }
          setError("The meeting has ended or you were disconnected.");
          setToken("");
        }}
      >
        <RoomPinProvider>
          <div className="h-full w-full relative z-0 pt-16 md:pt-20 pb-24 md:pb-28">
            <ParticipantGrid />
          </div>

          <div className="absolute inset-0 pointer-events-none z-50">
            <MeetingEndListener 
              onMeetingEnded={() => {
                setError("The meeting has been ended by the host.");
                setToken("");
              }} 
              roomName={roomName}
            />
            <div className="absolute top-0 left-0 right-0 h-16 pointer-events-auto">
              <RoomHeader roomName={roomName} />
            </div>

            <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-auto px-4">
              <MeetingControls roomName={roomName} userName={participantName} onRecordingStateChange={handleRecordingStateChange} />
            </div>

            <RecordingCountdown recordingDuration={recordingDuration} isRecording={isRecording} />
          </div>
        </RoomPinProvider>

        <RoomAudioRenderer />
        <StartAudio label="Click to enable audio" />
      </LiveKitRoom>
    </div>
  );
}
