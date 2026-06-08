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
                <div className="absolute -inset-4 rounded-full border-2 border-[#c16d18]/30 animate-ping opacity-40 duration-1000" />
                <div className="absolute -inset-8 rounded-full border border-[#c16d18]/15 animate-pulse opacity-20 duration-1500" />
              </>
            )}
            <div
              className={cn(
                "relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br from-[#c16d18] to-[#965310] rounded-full flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-extrabold shadow-2xl border border-white/10 text-white transition-all duration-500",
                isSpeaking && !isScreenShare && "scale-105 ring-4 ring-[#c16d18]/30 ring-offset-4 ring-offset-[#FBF9FA]"
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
          "absolute top-3 left-3 z-30 transition-opacity duration-300",
          isPinnedParticipant ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
        )}>
          <button
            type="button"
            onClick={() => togglePin(participant.identity)}
            title={isPinnedParticipant ? "Unpin participant" : "Pin to main screen"}
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg transition-all active:scale-90 cursor-pointer border border-stone-700/30",
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
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-stone-200/80 shadow-md text-stone-800 transition-all duration-300 group-hover:translate-x-1 pointer-events-auto">
          {isScreenShare && <Monitor size={12} className="text-[#c16d18]" />}
          <ParticipantName
            participant={participant}
            className="text-stone-800 text-xs font-bold truncate max-w-[80px] sm:max-w-[100px] md:max-w-none"
          />
          {participant.isLocal && <span className="text-[9px] text-[#c16d18] font-bold ml-1 uppercase tracking-wider">(You)</span>}
          {isScreenShare && <span className="text-[9px] text-stone-500 font-bold ml-1 uppercase tracking-wider">Screen</span>}
          {isPinnedParticipant && !isScreenShare && <Pin size={10} className="text-[#c16d18] ml-1" />}
        </div>

        {!isScreenShare && (
          <div className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center backdrop-blur-md border shadow-md transition-all duration-300 group-hover:-translate-x-1 pointer-events-auto",
            isAudioMuted
              ? "bg-red-500/95 border-red-500 text-white"
              : "bg-white/90 border-stone-200 text-[#c16d18] hover:bg-stone-50"
          )}>
            {isAudioMuted ? <MicOff size={12} /> : <Mic size={12} />}
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
