"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import "@livekit/components-styles";
import { getToken } from "@/lib/api";
import { getStoredRoomPassword, clearRoomPassword } from "@/lib/roomAccess";
import { RoomHeader } from "@/components/RoomHeader";
import { ParticipantGrid } from "@/components/ParticipantGrid";
import { MeetingControls } from "@/components/MeetingControls";
import { RecordingCountdown } from "@/components/RecordingCountdown";
import { RoomJoinGate } from "@/components/RoomJoinGate";
import { RoomPinProvider } from "@/contexts/RoomPinContext";
import { Loader2 } from "lucide-react";

// --------------------------------------------------------------------------
// MeetingEndListener — only the data-channel path.
// Polling has been removed permanently (it had a JS memory leak and caused
// false "meeting ended" errors on mobile via stale setInterval handles).
// --------------------------------------------------------------------------
function MeetingEndListener({ onMeetingEnded }: { onMeetingEnded: () => void }) {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const str = new TextDecoder().decode(payload);
        const msg = JSON.parse(str);
        if (msg?.type === "MEETING_ENDED") {
          console.log("[Room] Received MEETING_ENDED broadcast");
          onMeetingEnded();
          room.disconnect(true);
        }
      } catch { /* ignore */ }
    };
    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => { room.off(RoomEvent.DataReceived, handleDataReceived); };
  }, [room, onMeetingEnded]);

  return null;
}

// --------------------------------------------------------------------------
// RoomPage
// --------------------------------------------------------------------------
export default function RoomPage() {
  const params = useParams();
  const roomName = decodeURIComponent(params.id as string);
  const searchParams = useSearchParams();
  const router = useRouter();

  const nameFromQuery = searchParams.get("name") || "";
  const [participantName, setParticipantName] = useState(nameFromQuery);

  // password: the room password (persisted in passwordRef for reconnects)
  const [accessPassword, setAccessPassword] = useState<string | null>(null);
  const passwordRef = useRef<string | null>(null);

  // token: the LiveKit JWT — set ONLY when we have a good token ready
  const [token, setToken] = useState("");

  // error state  
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [storageChecked, setStorageChecked] = useState(false);

  // recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // meetingEndedRef is ONLY set true by the MEETING_ENDED data-channel broadcast.
  // It is NEVER set from failed reconnects — that was the root cause of the bug
  // where participants joining a live meeting saw "meeting ended by host".
  const meetingEndedRef = useRef(false);

  const handleRecordingStateChange = (rec: boolean, dur: number) => {
    setIsRecording(rec);
    setRecordingDuration(dur);
  };

  // ── 1. Restore password from localStorage on first page load ─────────────
  useEffect(() => {
    const storedToken = sessionStorage.getItem(`room_token_${roomName}`);
    if (storedToken) {
      setToken(storedToken);
      sessionStorage.removeItem(`room_token_${roomName}`);
      setStorageChecked(true);
      return;
    }
    const stored = getStoredRoomPassword(roomName);
    if (stored) {
      setAccessPassword(stored);
      passwordRef.current = stored;
    }
    setStorageChecked(true);
  }, [roomName]);

  // ── 2. Fetch a LiveKit token whenever we have a password but no token ─────
  // Also fires during silent reconnects triggered by onDisconnected Case 3.
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
          setToken(t);
          // Update URL with the name so refreshing works
          const url = new URL(window.location.href);
          url.searchParams.set("name", participantName.trim());
          router.replace(url.pathname + url.search, { scroll: false });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to join the room. Please try again.";
          // Bad password or other join error → back to join gate
          // NOTE: we do NOT set meetingEndedRef here under any circumstances.
          // That flag is only ever set by an explicit MEETING_ENDED broadcast.
          clearRoomPassword(roomName);
          setAccessPassword(null);
          passwordRef.current = null;
          setError(msg);
        }
      } finally {
        if (!cancelled) setConnecting(false);
      }
    };

    connect();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessPassword, token, roomName, participantName, router]);

  // Called by RoomJoinGate after successful token fetch there
  const handleVerified = (password: string, preloadedToken: string) => {
    setError("");
    meetingEndedRef.current = false;
    setAccessPassword(password);
    passwordRef.current = password;
    // Set the token directly — skips the useEffect getToken call (already done)
    setToken(preloadedToken);
  };

  const handleRetry = () => {
    setError("");
    setToken("");
    meetingEndedRef.current = false;
    setAccessPassword(null);
    passwordRef.current = null;
    clearRoomPassword(roomName);
  };

  // ── Render guards (in order) ──────────────────────────────────────────────

  // Still loading from localStorage
  if (!storageChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FBF9FA]">
        <Loader2 className="animate-spin text-[#c16d18]" size={32} />
      </div>
    );
  }

  // Meeting was explicitly ended by host (MEETING_ENDED broadcast received)
  // Show this BEFORE the join gate check so it isn't swallowed.
  if (meetingEndedRef.current) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FBF9FA] text-stone-900">
        <div className="text-center p-8 bg-white border border-stone-200/80 rounded-2xl shadow-xl max-w-md w-full mx-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            🔚
          </div>
          <h2 className="text-xl font-extrabold text-stone-900 mb-2">Meeting Ended</h2>
          <p className="text-stone-500 mb-6 text-sm">
            {error || "The meeting has been ended by the host."}
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="/"
              className="bg-[#c16d18] hover:bg-[#a0560e] text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // No credentials → show join gate
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

  // Need a name → show join gate with password pre-filled
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

  // Error during auto-reconnect or credential error → show join gate so user
  // can re-enter their password. The error message shows inside the gate.
  // NOTE: "Room is full" is a special case — show dedicated error UI.
  if (error && !token) {
    const isRoomFull = error.toLowerCase().includes("room is full");
    if (isRoomFull) {
      return (
        <div className="flex h-screen items-center justify-center bg-[#FBF9FA] text-stone-900">
          <div className="text-center p-8 bg-white border border-stone-200/80 rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              🚫
            </div>
            <h2 className="text-xl font-extrabold text-stone-900 mb-2">Meeting Room Full</h2>
            <p className="text-stone-500 mb-6 text-sm leading-relaxed">
              This meeting has reached its maximum capacity of <strong>5 participants</strong>.
              Please ask the host to make space or try again later.
            </p>
            <a
              href="/"
              className="bg-[#c16d18] hover:bg-[#a0560e] text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95"
            >
              Go Home
            </a>
          </div>
        </div>
      );
    }
    // For all other errors (wrong password, room not found, network error),
    // fall through to the join gate so the user can try again.
    return (
      <RoomJoinGate
        roomId={roomName}
        participantName={participantName}
        onNameChange={setParticipantName}
        onVerified={handleVerified}
        initialPassword={accessPassword || ""}
        serverError={error}
      />
    );
  }

  // No token yet → connecting or reconnecting
  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FBF9FA] text-stone-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-[#c16d18]" size={32} />
          <p className="font-bold">{connecting ? "Joining room..." : "Reconnecting..."}</p>
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
        options={{ disconnectOnPageLeave: false }}
        onDisconnected={() => {
          // Case 1: user pressed Leave
          if (sessionStorage.getItem("voluntary_leave")) {
            sessionStorage.removeItem("voluntary_leave");
            router.push("/");
            return;
          }
          // Case 2: host explicitly ended the meeting (data channel received)
          if (meetingEndedRef.current) {
            setToken("");
            return; // meetingEndedRef guard at top of render will show the ended screen
          }
          // Case 3: unexpected disconnect (mobile sleep, network blip)
          // Silently reconnect: clear token, re-set password → token-fetch useEffect fires.
          console.warn("[Room] Unexpected disconnect — reconnecting silently...");
          const pwd = passwordRef.current;
          setToken("");
          if (pwd) setAccessPassword(pwd);
        }}
      >
        <RoomPinProvider>
          <div className="h-full w-full relative z-0 pt-14 sm:pt-16 pb-20 sm:pb-24 md:pb-28">
            <ParticipantGrid />
          </div>

          <div className="absolute inset-0 pointer-events-none z-50">
            <MeetingEndListener
              onMeetingEnded={() => {
                // This is the ONLY place meetingEndedRef is set to true.
                meetingEndedRef.current = true;
                setError("The meeting has been ended by the host.");
                setToken("");
              }}
            />

            <div className="absolute top-0 left-0 right-0 h-14 sm:h-16 pointer-events-auto">
              <RoomHeader roomName={roomName} />
            </div>

            <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 flex justify-center pointer-events-auto px-2 sm:px-4">
              <MeetingControls
                roomName={roomName}
                userName={participantName}
                onRecordingStateChange={handleRecordingStateChange}
              />
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
