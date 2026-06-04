"use client";

import {
  TrackReference,
  TrackReferenceOrPlaceholder,
  isTrackReference
} from "@livekit/components-core";
import {
  AudioTrack,
  VideoTrack,
  ParticipantName,
  useIsSpeaking,
  useTracks
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Mic, MicOff, Monitor, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoomPin } from "@/contexts/RoomPinContext";

interface VideoTileProps {
  trackRef: TrackReferenceOrPlaceholder;
  isPinned?: boolean;
}

export function VideoTile({ trackRef, isPinned = false }: VideoTileProps) {
  const { pinnedIdentity, togglePin } = useRoomPin();
  const participant = trackRef.participant;
  const isSpeaking = useIsSpeaking(participant);
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;

  const micTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }], { onlySubscribed: false }).filter(
    (t) => t.participant.identity === participant.identity
  );
  const micTrack = micTracks[0];

  const isAudioMuted = !participant.isMicrophoneEnabled;
  const isVideoMuted = trackRef.source === Track.Source.Camera && !participant.isCameraEnabled;

  const hasVideo = isTrackReference(trackRef) && !!trackRef.publication;
  const isPinnedParticipant =
    isPinned || pinnedIdentity === participant.identity;
  const canPin = !isScreenShare;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-white transition-all duration-500 h-full w-full rounded-xl sm:rounded-2xl group",
        !isScreenShare && "border border-stone-200/80 shadow-sm",
        isSpeaking && !isScreenShare ? "ring-2 ring-[#c16d18] ring-offset-4 ring-offset-[#FBF9FA]" : "",
        isPinnedParticipant && !isScreenShare && "ring-2 ring-[#c16d18]/60",
        isScreenShare && "border-none shadow-xl"
      )}
    >
      {/* Video/Screen Stream */}
      {hasVideo && !isVideoMuted ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn(
            "absolute inset-0 w-full h-full transition-transform duration-700",
            isScreenShare ? "object-contain bg-stone-950" : "object-cover"
          )}
        />
      ) : (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#FBF9FA]">
          {/* Vibrant Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#c16d18]/5 via-transparent to-[#c16d18]/5" />

          <div className="relative w-14 h-14 sm:w-20 sm:h-20 md:w-22 md:h-22 bg-gradient-to-br from-[#c16d18] to-[#965310] rounded-full flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-extrabold shadow-lg shadow-[#c16d18]/20 border border-white/20 text-white animate-in zoom-in duration-500">
            {participant.name?.[0]?.toUpperCase() || "?"}
          </div>
        </div>
      )}

      {/* Audio Stream (Hidden) */}
      {micTrack && isTrackReference(micTrack) && !participant.isLocal && (
        <AudioTrack trackRef={micTrack} />
      )}

      {/* Pin control */}
      {canPin && (
        <div className={cn(
          "absolute top-2 left-2 sm:top-3 sm:left-3 z-30 transition-opacity duration-300",
          isPinnedParticipant ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
        )}>
          <button
            type="button"
            onClick={() => togglePin(participant.identity)}
            title={isPinnedParticipant ? "Unpin participant" : "Pin to main screen"}
            className={cn(
              "h-8 w-8 sm:h-8 sm:w-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-sm transition-all cursor-pointer",
              isPinnedParticipant
                ? "bg-black/60 text-white hover:bg-black/80"
                : "bg-black/30 text-white hover:bg-black/60"
            )}
          >
            {isPinnedParticipant ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
        </div>
      )}

      {/* Glassmorphic Overlays */}
      <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="bg-white/95 backdrop-blur-md px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-1.5 border border-stone-200 shadow-md text-stone-900 transition-transform duration-300 group-hover:translate-x-1 pointer-events-auto">
          {isScreenShare && <Monitor size={11} className="sm:w-3.5 sm:h-3.5 text-[#c16d18]" />}
          <ParticipantName
            participant={participant}
            className="text-stone-950 text-[10px] sm:text-[11px] md:text-[12px] font-bold truncate max-w-[60px] sm:max-w-[80px] md:max-w-none"
          />
          {participant.isLocal && <span className="text-[8px] sm:text-[9px] md:text-[10px] text-[#c16d18] font-black ml-0.5 uppercase tracking-wider">(You)</span>}
          {isScreenShare && <span className="text-[8px] sm:text-[9px] md:text-[10px] text-stone-500 font-bold ml-0.5 uppercase tracking-wider">Screen</span>}
          {isPinnedParticipant && !isScreenShare && <Pin size={10} className="sm:w-3 sm:h-3 text-[#c16d18] ml-0.5" />}
        </div>

        {!isScreenShare && (
          <div className={cn(
            "p-1.5 sm:p-2 rounded-lg sm:rounded-xl flex items-center justify-center backdrop-blur-md border shadow-md transition-all duration-300 group-hover:-translate-x-1 pointer-events-auto",
            isAudioMuted
              ? "bg-red-500 border-red-400 text-white"
              : "bg-white/95 border-stone-200 text-[#c16d18] hover:bg-stone-50"
          )}>
            {isAudioMuted ? <MicOff size={11} className="sm:w-3.5 sm:h-3.5" /> : <Mic size={11} className="sm:w-3.5 sm:h-3.5" />}
          </div>
        )}
      </div>

      {/* Speaking Indicator Pulse (Top Right) */}
      {isSpeaking && !isScreenShare && (
        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-[#c16d18] shadow-[0_0_12px_rgba(193,109,24,0.8)] animate-pulse z-10" />
      )}
    </div>
  );
}
