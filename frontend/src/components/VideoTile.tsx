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
        !isScreenShare && "border border-stone-200/80 shadow-sm",
        isSpeaking && !isScreenShare ? "ring-2 ring-[#c16d18] ring-offset-4 ring-offset-[#FBF9FA]" : "border-stone-200/80",
        isPinnedParticipant && !isScreenShare && "ring-2 ring-[#c16d18]/60",
        isScreenShare && "border-none shadow-xl"
      )}
    >
      {/* Video/Screen Stream */}
      {hasVideo && !isVideoMuted ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn(
            "absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-[1.02]",
            isScreenShare ? "object-contain bg-stone-950" : "object-cover"
          )}
        />
      ) : (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#FBF9FA]">
          {/* Vibrant Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#c16d18]/5 via-transparent to-[#c16d18]/5" />

          <div className="relative w-22 h-22 bg-gradient-to-br from-[#c16d18] to-[#965310] rounded-full flex items-center justify-center text-3xl font-extrabold mb-4 shadow-lg shadow-[#c16d18]/20 border border-white/20 text-white animate-in zoom-in duration-500">
            {participant.name?.[0]?.toUpperCase() || "?"}
          </div>

          {/* {!isScreenShare && (
            <div className="relative flex items-center gap-2 bg-white/80 border border-stone-200 px-4 py-1.5 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500">Waiting for Camera</span>
            </div>
          )} */}
        </div>
      )}

      {/* Audio Stream (Hidden) */}
      {micTrack && isTrackReference(micTrack) && !participant.isLocal && (
        <AudioTrack trackRef={micTrack} />
      )}

      {/* Pin control */}
      {canPin && (
        <div className={cn(
          "absolute top-3 right-3 z-20 transition-opacity duration-300",
          isPinnedParticipant ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <button
            type="button"
            onClick={() => togglePin(participant.identity)}
            title={isPinnedParticipant ? "Unpin participant" : "Pin to main screen"}
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-sm transition-all cursor-pointer",
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
        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-stone-200 shadow-md text-stone-900 transition-transform duration-300 group-hover:translate-x-1 pointer-events-auto">
          {isScreenShare && <Monitor size={13} className="text-[#c16d18]" />}
          <ParticipantName
            participant={participant}
            className="text-stone-950 text-[11px] md:text-[12px] font-bold truncate max-w-[80px] md:max-w-none"
          />
          {participant.isLocal && <span className="text-[9px] md:text-[10px] text-[#c16d18] font-black ml-1 uppercase tracking-wider">(You)</span>}
          {isScreenShare && <span className="text-[9px] md:text-[10px] text-stone-500 font-bold ml-1 uppercase tracking-wider">Screen</span>}
          {isPinnedParticipant && !isScreenShare && <Pin size={12} className="text-[#c16d18] ml-0.5" />}
        </div>

        {!isScreenShare && (
          <div className={cn(
            "p-2 rounded-xl flex items-center justify-center backdrop-blur-md border shadow-md transition-all duration-300 group-hover:-translate-x-1 pointer-events-auto",
            isAudioMuted
              ? "bg-red-500 border-red-400 text-white"
              : "bg-white/95 border-stone-200 text-[#c16d18] hover:bg-stone-50"
          )}>
            {isAudioMuted ? <MicOff size={13} /> : <Mic size={13} />}
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
