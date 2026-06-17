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
      data-participant-identity={participant.identity}
      className={cn(
        "relative overflow-hidden bg-white transition-all duration-500 h-full w-full rounded-2xl group",
        !isScreenShare && "border border-stone-200/80 shadow-md",
        isSpeaking && !isScreenShare ? "ring-2 ring-[#c16d18] ring-offset-2 ring-offset-[#FBF9FA]" : "",
        isPinnedParticipant && !isScreenShare && "ring-1 ring-[#c16d18]/60",
        isScreenShare && "border-none shadow-2xl"
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
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-stone-50 select-none">
          {/* Vibrant Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#c16d18]/5 via-transparent to-[#c16d18]/5" />

          {/* Fallback avatar with speaking visualizer ring */}
          <div className="relative flex items-center justify-center">
            {isSpeaking && !isScreenShare && (
              <>
                <div className="absolute -inset-2 sm:-inset-4 rounded-full border-2 border-[#c16d18]/30 animate-ping opacity-40 duration-1000" />
                <div className="absolute -inset-4 sm:-inset-8 rounded-full border border-[#c16d18]/15 animate-pulse opacity-20 duration-1500" />
              </>
            )}
            <div
              className={cn(
                "relative w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gradient-to-br from-[#c16d18] to-[#965310] rounded-full flex items-center justify-center text-sm sm:text-lg md:text-2xl font-extrabold shadow-2xl border border-white/10 text-white transition-all duration-500",
                isSpeaking && !isScreenShare && "scale-105 ring-2 sm:ring-4 ring-[#c16d18]/30 ring-offset-2 sm:ring-offset-4 ring-offset-[#FBF9FA]"
              )}
            >
              {participant.name?.[0]?.toUpperCase() || "?"}
            </div>
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
          "absolute top-1.5 left-1.5 sm:top-3 sm:left-3 z-30 transition-opacity duration-300",
          isPinnedParticipant ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
        )}>
          <button
            type="button"
            onClick={() => togglePin(participant.identity)}
            title={isPinnedParticipant ? "Unpin participant" : "Pin to main screen"}
            className={cn(
              "h-6 w-6 sm:h-8 sm:w-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg transition-all active:scale-90 cursor-pointer border border-stone-700/30",
              isPinnedParticipant
                ? "bg-black/60 text-white hover:bg-black/80"
                : "bg-black/30 text-white hover:bg-black/60"
            )}
          >
            {isPinnedParticipant ? <PinOff size={10} className="sm:w-3.5 sm:h-3.5" /> : <Pin size={10} className="sm:w-3.5 sm:h-3.5" />}
          </button>
        </div>
      )}

      {/* Glassmorphic Overlays */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 sm:bottom-3 sm:left-3 sm:right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="bg-white/90 backdrop-blur-md px-1.5 py-0.5 sm:px-2.5 sm:py-1 md:px-3 md:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-1.5 border border-stone-200/80 shadow-md text-stone-800 transition-all duration-300 group-hover:translate-x-1 pointer-events-auto">
          {isScreenShare && <Monitor size={10} className="text-[#c16d18] sm:w-3 sm:h-3" />}
          <span className="text-[10px] sm:text-xs font-bold text-stone-800 truncate max-w-[50px] sm:max-w-[80px] md:max-w-[120px]">
            {participant.name || participant.identity}
          </span>
          {participant.isLocal && <span className="text-[8px] sm:text-[9px] text-[#c16d18] font-bold ml-0.5 uppercase tracking-wider">(You)</span>}
          {isScreenShare && <span className="text-[8px] sm:text-[9px] text-stone-500 font-bold ml-0.5 uppercase tracking-wider">Screen</span>}
          {isPinnedParticipant && !isScreenShare && <Pin size={8} className="text-[#c16d18] ml-0.5 sm:w-2.5 sm:h-2.5" />}
        </div>

        {!isScreenShare && (
          <div className={cn(
            "h-6 w-6 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl flex items-center justify-center backdrop-blur-md border shadow-md transition-all duration-300 group-hover:-translate-x-1 pointer-events-auto",
            isAudioMuted
              ? "bg-red-500/95 border-red-500 text-white"
              : "bg-white/90 border-stone-200 text-[#c16d18] hover:bg-stone-50"
          )}>
            {isAudioMuted ? <MicOff size={10} className="sm:w-3 sm:h-3" /> : <Mic size={10} className="sm:w-3 sm:h-3" />}
          </div>
        )}
      </div>

      {/* Speaking Indicator Pulse (Top Right) */}
      {isSpeaking && !isScreenShare && (
        <div className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-[#c16d18] shadow-[0_0_12px_rgba(193,109,24,0.9)] animate-pulse z-10 border border-white" />
      )}
    </div>
  );
}
