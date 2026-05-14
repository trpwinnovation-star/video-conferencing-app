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
import { Mic, MicOff, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoTileProps {
  trackRef: TrackReferenceOrPlaceholder;
}

export function VideoTile({ trackRef }: VideoTileProps) {
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

  return (
    <div 
      className={cn(
        "relative overflow-hidden bg-slate-900 transition-all duration-500 h-full w-full rounded-2xl group",
        !isScreenShare && "border border-white/5",
        isSpeaking && !isScreenShare ? "ring-2 ring-blue-500 ring-offset-4 ring-offset-slate-950" : "border-white/5",
        isScreenShare && "border-none shadow-2xl"
      )}
    >
      {/* Video/Screen Stream */}
      {hasVideo && !isVideoMuted ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn(
            "absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-[1.02]",
            isScreenShare ? "object-contain bg-black/40" : "object-cover"
          )}
        />
      ) : (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#0F172A]">
          {/* Vibrant Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10" />
          
          <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-[0_0_40px_rgba(59,130,246,0.3)] border border-white/20 text-white animate-in zoom-in duration-500">
            {participant.name?.[0]?.toUpperCase() || "?"}
          </div>
          
          {!isScreenShare && (
            <div className="relative flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
              <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">Waiting for Camera</span>
            </div>
          )}
        </div>
      )}

      {/* Audio Stream (Hidden) */}
      {micTrack && isTrackReference(micTrack) && !participant.isLocal && (
        <AudioTrack trackRef={micTrack} />
      )}

      {/* Glassmorphic Overlays */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/10 shadow-lg transition-transform duration-300 group-hover:translate-x-1">
          {isScreenShare && <Monitor size={14} className="text-blue-400" />}
          <ParticipantName 
            participant={participant} 
            className="text-white text-[13px] font-semibold truncate"
          />
          {participant.isLocal && <span className="text-[10px] text-blue-400 font-bold ml-1">(You)</span>}
          {isScreenShare && <span className="text-[10px] text-slate-400 font-medium ml-1">Screen</span>}
        </div>
        
        {!isScreenShare && (
          <div className={cn(
            "p-2 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/10 transition-all duration-300 group-hover:-translate-x-1",
            isAudioMuted ? "bg-red-500/80 text-white" : "bg-black/40 text-slate-300"
          )}>
            {isAudioMuted ? <MicOff size={14} /> : <Mic size={14} />}
          </div>
        )}
      </div>

      {/* Speaking Indicator Pulse (Top Right) */}
      {isSpeaking && !isScreenShare && (
        <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)] animate-pulse" />
      )}
    </div>
  );
}
