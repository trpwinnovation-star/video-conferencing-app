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
import { getToken, checkRoomStatus } from "@/lib/api";
import { getStoredRoomPassword, clearRoomPassword } from "@/lib/roomAccess";
import { RoomHeader } from "@/components/RoomHeader";
import { ParticipantGrid } from "@/components/ParticipantGrid";
import { MeetingControls } from "@/components/MeetingControls";
import { RecordingCountdown } from "@/components/RecordingCountdown";
import { RoomJoinGate } from "@/components/RoomJoinGate";
import { RoomPinProvider } from "@/contexts/RoomPinContext";
import { Loader2 } from "lucide-react";

// --------------------------------------------------------------------------
// MeetingEndListener
// Handles two cases:
//   1. Host broadcasts MEETING_ENDED via data channel → kick everyone
//   2. Non-host polls every 5 s to see if the room still exists in LiveKit
// --------------------------------------------------------------------------
function MeetingEndListener({
  onMeetingEnded,
  roomName,
  isHostRef,
}: {
  onMeetingEnded: () => void;
  roomName: string;
  isHostRef: React.MutableRefObject<boolean>;
}) {
  const room = useRoomContext();

  // ── 1. Data channel: ALL participants listen for MEETING_ENDED ──────────
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const str = new TextDecoder().decode(payload);
        const msg = JSON.parse(str);
        if (msg?.type === "MEETING_ENDED") {
          console.log("[Room] Received MEETING_ENDED broadcast from host");
          onMeetingEnded();
          room.disconnect(true);
        }
      } catch {
        // ignore parse errors
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, onMeetingEnded]);

  // ── 2. Poll only for NON-HOST participants ──────────────────────────────
  // We use the isHostRef (set once on token generation) rather than reading
  // metadata from the room, which can be null during reconnection.
  useEffect(() => {
    if (!room) return;
    // Give the room a moment to stabilise, then check the ref
    const initTimer = setTimeout(() => {
      if (isHostRef.current) return; // host never polls

      let pollInterval: NodeJS.Timeout | null = null;

      pollInterval = setInterval(async () => {
        try {
          const status = await checkRoomStatus(roomName);
          if (!status.exists) {
            console.log("[Room] Poll: room no longer exists → meeting ended");
            onMeetingEnded();
            if (room && room.state !== "disconnected") {
              await room.disconnect(true);
            }
          }
        } catch (error) {
          // Network error while polling — treat as room still alive (fail safe)
          console.warn("[Room] Poll: error checking room status:", error);
        }
      }, 5000);

      return () => {
        if (pollInterval) clearInterval(pollInterval);
      };
    }, 3000);

    return () => clearTimeout(initTimer);
  }, [room, roomName, isHostRef, onMeetingEnded]);

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
  const [accessPassword, setAccessPassword] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [storageChecked, setStorageChecked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // ── Refs that survive re-renders without triggering them ─────────────────
  // meetingEndedRef: true only when host deliberately broadcasts MEETING_ENDED
  const meetingEndedRef = useRef(false);
  // isHostRef: set once when we receive the token, used by the poll loop
  const isHostRef = useRef(false);
  // passwordRef: mirror of accessPassword so the reconnect logic always has
  // the latest password even without re-running effects
  const passwordRef = useRef<string | null>(null);

  const handleRecordingStateChange = (rec: boolean, dur: number) => {
    setIsRecording(rec);
    setRecordingDuration(dur);
  };

  // ── Restore password from localStorage on first load ─────────────────────
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

  // ── Fetch a LiveKit token whenever we have a password but no token ────────
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
          if (!t) throw new Error("No token received from server");
          setToken(t);
          const url = new URL(window.location.href);
          url.searchParams.set("name", participantName.trim());
          router.replace(url.pathname + url.search, { scroll: false });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          // If the room is gone (404/400) this is a legitimate "meeting ended"
          const msg = e instanceof Error ? e.message : "Failed to join the room. Please try again.";
          const roomGone = msg.toLowerCase().includes("not found") || msg.includes("404");
          if (roomGone && meetingEndedRef.current) {
            // Already flagged as ended — don't clear the password, just show error
            setError("The meeting has been ended by the host.");
            setToken("");
          } else {
            clearRoomPassword(roomName);
            setAccessPassword(null);
            passwordRef.current = null;
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) setConnecting(false);
      }
    };

    connect();
    return () => { cancelled = true; };
    // Intentionally omit connecting/error to avoid re-triggering mid-flight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessPassword, token, roomName, participantName, router]);

  const handleVerified = (password: string, preloadedToken: string) => {
    setError("");
    setAccessPassword(password);
    passwordRef.current = password;
    // Use the token already fetched during password verification — no second API call needed
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

  // ── Render guards ─────────────────────────────────────────────────────────

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

  // Only show the error screen when the meeting was deliberately ended.
  // For transient disconnects we just show a reconnecting spinner.
  if (error && !token && meetingEndedRef.current) {
    const isRoomFull = error.toLowerCase().includes("room is full");
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
        options={{
          // Tell LiveKit to attempt automatic reconnection before giving up.
          // This handles phone-sleep / network blips transparently.
          disconnectOnPageLeave: false,
        }}
        onDisconnected={() => {
          // ── Case 1: voluntary leave (user pressed Leave button) ──────────
          if (sessionStorage.getItem("voluntary_leave")) {
            sessionStorage.removeItem("voluntary_leave");
            router.push("/");
            return;
          }

          // ── Case 2: host deliberately ended the meeting ──────────────────
          if (meetingEndedRef.current) {
            setError("The meeting has been ended by the host.");
            setToken("");
            return;
          }

          // ── Case 3: unexpected disconnect (phone sleep / network blip) ───
          // Silently clear the token; the token-fetch effect will immediately
          // re-request a fresh token using the passwordRef and reconnect.
          console.warn("[Room] Unexpected disconnect — reconnecting silently...");
          const pwd = passwordRef.current;
          setToken("");
          if (pwd) {
            // Re-set accessPassword so the token-fetch effect fires again
            setAccessPassword(pwd);
          }
        }}
      >
        <RoomPinProvider>
          <div className="h-full w-full relative z-0 pt-14 sm:pt-16 pb-20 sm:pb-24 md:pb-28">
            <ParticipantGrid />
          </div>

          <div className="absolute inset-0 pointer-events-none z-50">
            <MeetingEndListener
              onMeetingEnded={() => {
                meetingEndedRef.current = true;
                setError("The meeting has been ended by the host.");
                setToken("");
              }}
              roomName={roomName}
              isHostRef={isHostRef}
            />
            <div className="absolute top-0 left-0 right-0 h-14 sm:h-16 pointer-events-auto">
              <RoomHeader roomName={roomName} />
            </div>

            <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 flex justify-center pointer-events-auto px-2 sm:px-4">
              <MeetingControls
                roomName={roomName}
                userName={participantName}
                onRecordingStateChange={handleRecordingStateChange}
                onHostStatusKnown={(host) => { isHostRef.current = host; }}
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
