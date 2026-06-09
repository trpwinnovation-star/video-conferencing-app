"use client";

import React from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { ParticipantEvent } from "livekit-client";
import { PhoneOff, X, MessageSquare } from "lucide-react";
import { AudioToggleButton } from "./AudioToggleButton";
import { VideoToggleButton } from "./VideoToggleButton";
import { CameraFlipButton } from "./CameraFlipButton";
import { ScreenShareButton } from "./ScreenShareButton";
import { RecordingControls } from "./RecordingControls";
import { SaveRecordingModal } from "./SaveRecordingModal";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface MeetingControlsProps {
  roomName: string;
  userName?: string;
  onRecordingStateChange?: (isRecording: boolean, duration: number) => void;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  unreadChatCount?: number;
}

export function MeetingControls({
  roomName,
  userName,
  onRecordingStateChange,
  onToggleChat,
  isChatOpen = false,
  unreadChatCount = 0,
}: MeetingControlsProps) {
  const room = useRoomContext();
  const router = useRouter();
  // Obtain the local participant from the hook
  const { localParticipant } = useLocalParticipant();
  
  // Track metadata with React state so it re-renders when it arrives from the server
  const [participantMeta, setParticipantMeta] = React.useState<string | undefined>(
    localParticipant?.metadata
  );

  React.useEffect(() => {
    if (!localParticipant) return;
    
    setParticipantMeta(localParticipant.metadata);
    
    const handleMetadataChanged = (prevMetadata: string | undefined) => {
      // The event signature in livekit-client provides the previous metadata,
      // but the current metadata is already updated on the object.
      setParticipantMeta(localParticipant.metadata);
    };

    localParticipant.on(ParticipantEvent.ParticipantMetadataChanged, handleMetadataChanged);
    return () => {
      localParticipant.off(ParticipantEvent.ParticipantMetadataChanged, handleMetadataChanged);
    };
  }, [localParticipant]);

  const isHost = React.useMemo(() => {
    console.log('Local participant metadata:', participantMeta);
    if (!participantMeta) return false;
    try {
      const meta = JSON.parse(participantMeta);
      return meta.isHost === true;
    } catch {
      return false;
    }
  }, [participantMeta]);

  const [showRecordPopup, setShowRecordPopup] = React.useState(false);
  const [hasShownPopup, setHasShownPopup] = React.useState(false);

  React.useEffect(() => {
    if (isHost && !hasShownPopup) {
      setShowRecordPopup(true);
      setHasShownPopup(true);
      const timer = setTimeout(() => setShowRecordPopup(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [isHost, hasShownPopup]);

  // Leave confirmation state
  const [showLeaveConfirm, setShowLeaveConfirm] = React.useState(false);
  const [confirmReady, setConfirmReady] = React.useState(false);
  const isLeavingRef = React.useRef(false);

  // Small delay before the confirm button is active — prevents ghost touch on mobile
  // (the same touch that opens the modal from triggering the confirm immediately)
  React.useEffect(() => {
    if (showLeaveConfirm) {
      setConfirmReady(false);
      const t = setTimeout(() => setConfirmReady(true), 350);
      return () => clearTimeout(t);
    }
  }, [showLeaveConfirm]);

  // Recording save modal state
  const [recordingBlob, setRecordingBlob] = React.useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const [showSaveModal, setShowSaveModal] = React.useState(false);

  const handleRecordingReady = (blob: Blob, duration: number) => {
    setRecordingBlob(blob);
    setRecordingDuration(duration);
    setShowSaveModal(true);
  };

  const handleLeave = async () => {
    if (isLeavingRef.current) return; // prevent double-fire
    isLeavingRef.current = true;

    // Safety net: always redirect home after 3 seconds no matter what
    const safetyTimer = setTimeout(() => {
      router.push("/");
    }, 3000);

    try {
      sessionStorage.setItem("voluntary_leave", "true");
      if (isHost) {
        // Broadcast MEETING_ENDED signal to all participants via Data Channel first
        if (room && room.localParticipant) {
          try {
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify({ type: 'MEETING_ENDED' }));
            await room.localParticipant.publishData(data, { reliable: true });
            console.log("MEETING_ENDED signal sent to participants");
          } catch (err) {
            console.warn("Failed to send meeting ended signal", err);
          }
        }

        // Wait 400ms to give signals time to emit before we trigger backend cleanup
        await new Promise(resolve => setTimeout(resolve, 400));

        // Fire the backend API to end the meeting for ALL participants and clean up DB/LiveKit
        try {
          const { apiEndMeeting } = await import("@/lib/api");
          await apiEndMeeting(roomName);
          console.log("Meeting ended successfully via API");
        } catch (e) {
          console.warn("Failed to end meeting via API:", e);
        }
      }
    } catch (e) {
      console.warn("Error during leave:", e);
    } finally {
      clearTimeout(safetyTimer);
      // Navigate to homepage first so the page transition starts immediately
      router.push("/");
      // Trigger disconnect asynchronously in the background so it doesn't block the routing
      if (room && room.state !== "disconnected") {
        room.disconnect(true).catch(e => console.warn(e));
      }
    }
  };


  return (
    <>
      <div className="relative flex items-center gap-1 md:gap-3 bg-white/95 backdrop-blur-xl border border-stone-200/80 p-2 md:p-3 md:px-6 rounded-2xl md:rounded-3xl shadow-xl shadow-stone-300/40">

        {/* Record Reminder Popup */}
        {showRecordPopup && (
          <div className="absolute -top-20 sm:-top-20 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-2xl flex items-center gap-2 sm:gap-3 animate-in fade-in zoom-in-95 duration-300 z-50 max-w-[280px] sm:max-w-none">
            <div className="w-2 h-2 rounded-full bg-[#c16d18] animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)] shrink-0" />
            <span className="text-[10px] sm:text-sm font-medium leading-tight">Meeting started! Click record to record.</span>
            <button onClick={() => setShowRecordPopup(false)} className="shrink-0 p-1.5 text-stone-400 hover:text-white rounded-full hover:bg-stone-800 transition-colors cursor-pointer">
              <X size={16} />
            </button>
            {/* Tooltip arrow pointing down */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900" />
          </div>
        )}


        <div className="flex flex-col items-center gap-1 group">
          <AudioToggleButton />
          <span className="hidden md:block text-[9px] font-bold text-stone-500 group-hover:text-[#c16d18] transition-colors uppercase tracking-wider">Mute</span>
        </div>

        <div className="flex flex-col items-center gap-1 group">
          <VideoToggleButton />
          <span className="hidden md:block text-[9px] font-bold text-stone-500 group-hover:text-[#c16d18] transition-colors uppercase tracking-wider">Video</span>
        </div>

        <CameraFlipButton />

        <div className="hidden md:block w-px h-10 bg-stone-200 mx-1" />

        <div className="flex flex-col items-center gap-1 group">
          <ScreenShareButton />
          <span className="hidden md:block text-[9px] font-bold text-stone-500 group-hover:text-[#c16d18] transition-colors uppercase tracking-wider">Share</span>
        </div>

        {isHost && (
          <div className="flex flex-col items-center gap-1 group">
            <RecordingControls roomName={roomName} userName={userName} onRecordStart={() => setShowRecordPopup(false)} onRecordingStateChange={onRecordingStateChange} onRecordingReady={handleRecordingReady} />
            <span className="hidden md:block text-[9px] font-bold text-stone-500 group-hover:text-[#c16d18] transition-colors uppercase tracking-wider">Record</span>
          </div>
        )}

        <div className="flex flex-col items-center gap-1 group">
          <button
            onClick={onToggleChat}
            className={cn(
              "h-10 w-14 md:h-12 md:w-20 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer relative border",
              isChatOpen
                ? "bg-[#c16d18] text-white border-[#c16d18] shadow-[#c16d18]/25"
                : "bg-white border-stone-200 text-stone-700 hover:text-stone-900 hover:bg-stone-50"
            )}
          >
            <MessageSquare size={20} className="md:w-[22px] md:h-[22px]" />
            {unreadChatCount > 0 ? (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-red-500 border border-white text-white text-[9px] font-black rounded-full flex items-center justify-center animate-bounce">
                {unreadChatCount}
              </span>
            ) : null}
          </button>
          <span className="hidden md:block text-[9px] font-bold text-stone-500 group-hover:text-[#c16d18] transition-colors uppercase tracking-wider">Chat</span>
        </div>

        <div className="hidden md:block w-px h-10 bg-stone-200 mx-1" />

        <div className="flex flex-col items-center gap-1 group">
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="h-10 w-14 md:h-12 md:w-20 rounded-2xl flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all shadow-md shadow-red-200 active:scale-95 cursor-pointer border border-red-400"
          >
            <PhoneOff size={20} className="md:w-[22px] md:h-[22px]" />
          </button>
          <span className="hidden md:block text-[9px] font-bold text-red-500 group-hover:text-red-600 transition-colors uppercase tracking-wider">Leave</span>
        </div>
      </div>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200/80 p-6 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-bold text-stone-900 mb-2">
              {isHost ? "End meeting?" : "Leave meeting?"}
            </h3>
            <p className="text-sm text-stone-500 mb-6">
              {isHost
                ? "You are the host. Leaving will end the meeting for all participants."
                : "Are you sure you want to exit this meeting?"}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-sm hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!confirmReady) return;
                  setShowLeaveConfirm(false);
                  handleLeave();
                }}
                disabled={!confirmReady}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-bold text-sm transition-colors shadow-md shadow-red-200 cursor-pointer"
              >
                {isHost ? "End Meeting" : "Yes, Leave"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Save Recording Modal */}
      {showSaveModal && recordingBlob && (
        <SaveRecordingModal
          isOpen={showSaveModal}
          onClose={() => {
            setShowSaveModal(false);
            setRecordingBlob(null);
          }}
          blob={recordingBlob}
          roomName={roomName}
          duration={recordingDuration}
        />
      )}
    </>
  );
}

