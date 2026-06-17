"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import "@livekit/components-styles";
import { getToken, apiUploadSharedFile } from "@/lib/api";
import { getStoredRoomPassword, clearRoomPassword } from "@/lib/roomAccess";
import { RoomHeader } from "@/components/RoomHeader";
import { ParticipantGrid } from "@/components/ParticipantGrid";
import { MeetingControls } from "@/components/MeetingControls";
import { RecordingCountdown } from "@/components/RecordingCountdown";
import { RoomJoinGate } from "@/components/RoomJoinGate";
import { RoomPinProvider } from "@/contexts/RoomPinContext";
import { MobileAudioGate } from "@/components/MobileAudioGate";
import { Loader2 } from "lucide-react";
import { ChatPanel, ChatMessage } from "@/components/ChatPanel";

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
// ActiveRoomContent — Handles real-time chat, file sharing, and grid layout
// --------------------------------------------------------------------------
interface ActiveRoomContentProps {
  roomName: string;
  participantName: string;
  onRecordingStateChange: (rec: boolean, dur: number) => void;
  isRecording: boolean;
  recordingDuration: number;
  onMeetingEnded: () => void;
}

function ActiveRoomContent({
  roomName,
  participantName,
  onRecordingStateChange,
  isRecording,
  recordingDuration,
  onMeetingEnded,
}: ActiveRoomContentProps) {
  const room = useRoomContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Listen to data channel for incoming messages or files
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = async (payload: Uint8Array, participant?: any) => {
      try {
        const str = new TextDecoder().decode(payload);
        const msg = JSON.parse(str);

        if (msg.type === "CHAT_MESSAGE" || msg.type === "FILE_SHARE") {
          const isLocal = participant?.identity === room.localParticipant.identity;
          const newMsg: ChatMessage = {
            id: msg.id,
            sender: msg.sender,
            text: msg.text,
            file: msg.file,
            timestamp: msg.timestamp,
            isLocal,
          };
          setMessages((prev) => [...prev, newMsg]);

          if (!isChatOpen && !isLocal) {
            setUnreadCount((prev) => prev + 1);
          }
        }

        // --- Geo Capture Signals ---
        if (msg.type === "REQUEST_LOCATION" && msg.targetIdentity === room.localParticipant.identity) {
          console.log("[GeoCapture] Location request received from host");
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              let address = "Unknown Location";
              try {
                // Fetch location details from Nominatim (OpenStreetMap)
                const geoRes = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                );
                if (geoRes.ok) {
                  const geoData = await geoRes.json();
                  address = geoData.display_name || geoData.address?.city || geoData.address?.town || "Unknown Location";
                }
              } catch (geoErr) {
                console.warn("[GeoCapture] Failed to resolve address name:", geoErr);
              }

              // Reply back to host
              const replyPayload = {
                type: "RESPOND_LOCATION",
                targetIdentity: room.localParticipant.identity,
                latitude,
                longitude,
                address,
              };
              const encoder = new TextEncoder();
              const replyData = encoder.encode(JSON.stringify(replyPayload));
              await room.localParticipant.publishData(replyData, { reliable: true });
            },
            async (err) => {
              console.error("[GeoCapture] Geolocation error:", err);
              // Send error fallback response
              const replyPayload = {
                type: "RESPOND_LOCATION",
                targetIdentity: room.localParticipant.identity,
                latitude: 0,
                longitude: 0,
                address: `Geolocation Error: ${err.message}`,
              };
              const encoder = new TextEncoder();
              const replyData = encoder.encode(JSON.stringify(replyPayload));
              await room.localParticipant.publishData(replyData, { reliable: true });
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }

        if (msg.type === "RESPOND_LOCATION") {
          // Verify if local participant is host
          let isLocalHost = false;
          try {
            const meta = JSON.parse(room.localParticipant.metadata || '{}');
            isLocalHost = meta.isHost === true;
          } catch { }

          if (isLocalHost) {
            console.log(`[GeoCapture] Received location from ${msg.targetIdentity}`);

            // 1. Locate the video element for this participant
            const tileElement = document.querySelector(`[data-participant-identity="${msg.targetIdentity}"]`);
            const videoElement = tileElement?.querySelector("video");

            if (!videoElement) {
              console.error("[GeoCapture] Could not find video element for participant:", msg.targetIdentity);
              return;
            }

            // 2. Draw frame on canvas
            const canvas = document.createElement("canvas");
            const width = videoElement.videoWidth || 640;
            const height = videoElement.videoHeight || 480;
            const bannerHeight = 105;
            canvas.width = width;
            canvas.height = height + bannerHeight; // Append footer space

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Draw video frame (completely untouched)
            ctx.drawImage(videoElement, 0, 0, width, height);

            // 3. Draw watermarked footer banner below the video
            ctx.fillStyle = "#1e1e1e"; // Sleek dark theme
            ctx.fillRect(0, height, width, bannerHeight);

            // Draw border line separating video and footer
            ctx.strokeStyle = "#c16d18";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, height);
            ctx.lineTo(width, height);
            ctx.stroke();

            // Text styling
            ctx.fillStyle = "#ffffff";
            const fontSize = Math.max(11, Math.floor(width * 0.02));
            ctx.font = `bold ${fontSize}px sans-serif`;

            const padding = 15;
            const lineSpacing = fontSize + 5;
            let currentY = height + padding + 5;

            const targetName = participant?.name || msg.targetIdentity;
            ctx.fillText(`TARGET IDENTITY: ${targetName}`, padding, currentY);

            ctx.fillStyle = "#c16d18";
            currentY += lineSpacing;
            ctx.fillText(`COORDINATES: Lat ${msg.latitude.toFixed(6)}, Lon ${msg.longitude.toFixed(6)}`, padding, currentY);

            ctx.fillStyle = "#ffffff";
            currentY += lineSpacing;

            // Wrap address text if it's too long
            const maxTextWidth = width - (padding * 2);
            const addressText = `LOCATION: ${msg.address}`;
            const words = addressText.split(" ");
            let line = "";
            let addressLines = [];

            for (let n = 0; n < words.length; n++) {
              let testLine = line + words[n] + " ";
              let metrics = ctx.measureText(testLine);
              let testWidth = metrics.width;
              if (testWidth > maxTextWidth && n > 0) {
                addressLines.push(line);
                line = words[n] + " ";
              } else {
                line = testLine;
              }
            }
            addressLines.push(line);

            addressLines.slice(0, 2).forEach((addrLine) => {
              ctx.fillText(addrLine, padding, currentY);
              currentY += lineSpacing;
            });

            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.font = `italic ${Math.max(9, fontSize - 2)}px sans-serif`;
            ctx.fillText(`Time: ${new Date().toLocaleString()}`, padding, height + bannerHeight - 10);

            // 4. Convert canvas to blob and upload
            canvas.toBlob(async (blob) => {
              if (!blob) return;

              try {
                // Convert blob to File object
                const fileName = `verification-${msg.targetIdentity}-${Date.now()}.jpg`;
                const file = new File([blob], fileName, { type: "image/jpeg" });

                // Upload via API
                const uploaded = await apiUploadSharedFile(file, roomName);

                // Construct file share message
                const fileSharePayload = {
                  id: Math.random().toString(36).substring(2, 9),
                  type: "FILE_SHARE",
                  sender: participantName,
                  file: {
                    name: `GeoCapture - ${targetName}.jpg`,
                    size: blob.size,
                    url: uploaded.fileUrl
                  },
                  timestamp: Date.now()
                };

                // Broadcast file share message only to the target participant for privacy
                const encoder = new TextEncoder();
                const shareData = encoder.encode(JSON.stringify(fileSharePayload));
                await room.localParticipant.publishData(shareData, {
                  reliable: true,
                  destinationIdentities: [msg.targetIdentity]
                });

                // Append locally in host chat
                setMessages((prev) => [
                  ...prev,
                  {
                    id: fileSharePayload.id,
                    sender: participantName,
                    file: fileSharePayload.file,
                    timestamp: Date.now(),
                    isLocal: true,
                  }
                ]);

              } catch (uploadErr) {
                console.error("[GeoCapture] Failed to upload captured image:", uploadErr);
              }
            }, "image/jpeg", 0.85);
          }
        }
      } catch (err) {
        console.error("Error parsing incoming message:", err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, isChatOpen, roomName, participantName]);

  // Clear unread badge when chat is opened
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  const handleSendMessage = async (text: string) => {
    if (!room) return;
    const msgId = Math.random().toString(36).substring(2, 9);
    const payload = {
      id: msgId,
      type: "CHAT_MESSAGE",
      sender: participantName,
      text,
      timestamp: Date.now(),
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));

    // Broadcast text message
    await room.localParticipant.publishData(data, { reliable: true });

    // Append locally
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        sender: participantName,
        text,
        timestamp: Date.now(),
        isLocal: true,
      },
    ]);
  };

  const handleSendFile = async (fileInfo: { name: string; size: number; url: string }) => {
    if (!room) return;
    const msgId = Math.random().toString(36).substring(2, 9);
    const payload = {
      id: msgId,
      type: "FILE_SHARE",
      sender: participantName,
      file: fileInfo,
      timestamp: Date.now(),
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));

    // Broadcast file sharing details
    await room.localParticipant.publishData(data, { reliable: true });

    // Append locally
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        sender: participantName,
        file: fileInfo,
        timestamp: Date.now(),
        isLocal: true,
      },
    ]);
  };

  const handleTriggerGeoCapture = async (targetIdentity: string) => {
    if (!room) return;
    console.log(`[GeoCapture] Host requesting geolocation for: ${targetIdentity}`);
    const payload = {
      type: "REQUEST_LOCATION",
      targetIdentity,
    };
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    await room.localParticipant.publishData(data, { reliable: true });
  };

  return (
    <div className="h-full w-full relative flex overflow-hidden bg-[#FBF9FA]">
      {/* Main meeting area */}
      <div className="flex-grow flex flex-col relative h-full min-w-0">
        <div className="flex-grow relative z-0 pt-14 sm:pt-16 pb-20 sm:pb-24 md:pb-28">
          <ParticipantGrid />
        </div>

        <div className="absolute inset-0 pointer-events-none z-40">
          <MeetingEndListener onMeetingEnded={onMeetingEnded} />

          <div className="absolute top-0 left-0 right-0 h-14 sm:h-16 pointer-events-auto">
            <RoomHeader roomName={roomName} />
          </div>

          <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 flex justify-center pointer-events-auto px-2 sm:px-4">
            <MeetingControls
              roomName={roomName}
              userName={participantName}
              onRecordingStateChange={onRecordingStateChange}
              onToggleChat={() => setIsChatOpen((prev) => !prev)}
              isChatOpen={isChatOpen}
              unreadChatCount={unreadCount}
            />
          </div>

          <RecordingCountdown recordingDuration={recordingDuration} isRecording={isRecording} />
        </div>
      </div>

      {/* Slide-out Chat Panel */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        roomId={roomName}
        onTriggerGeoCapture={handleTriggerGeoCapture}
      />
    </div>
  );
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
            // Clear stored password on deliberate exit — prevents lingering
            // credentials on shared devices.
            clearRoomPassword(roomName);
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
          <ActiveRoomContent
            roomName={roomName}
            participantName={participantName}
            onRecordingStateChange={handleRecordingStateChange}
            isRecording={isRecording}
            recordingDuration={recordingDuration}
            onMeetingEnded={() => {
              meetingEndedRef.current = true;
              setError("The meeting has been ended by the host.");
              setToken("");
            }}
          />
        </RoomPinProvider>

        <RoomAudioRenderer />
        <MobileAudioGate />
      </LiveKitRoom>
    </div>
  );
}
