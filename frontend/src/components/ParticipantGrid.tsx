"use client";

import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { VideoTile } from "./VideoTile";
import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, LayoutGrid, Monitor } from "lucide-react";

export function ParticipantGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenShareTracks = useMemo(
    () => tracks.filter((t) => t.source === Track.Source.ScreenShare),
    [tracks]
  );
  
  const cameraTracks = useMemo(
    () => tracks.filter((t) => t.source === Track.Source.Camera),
    [tracks]
  );

  const [layoutMode, setLayoutMode] = useState<"grid" | "stage">("grid");
  const [showFilmstrip, setShowFilmstrip] = useState(true);

  // Auto-switch to stage mode when screen share starts
  useEffect(() => {
    if (screenShareTracks.length > 0) {
      setLayoutMode("stage");
    } else {
      setLayoutMode("grid");
    }
  }, [screenShareTracks.length]);

  if (tracks.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 font-medium animate-pulse">
        <Monitor size={48} className="mb-4 text-[#c16d18] opacity-35" />
        <p className="font-semibold text-stone-600">Connecting to room...</p>
      </div>
    );
  }

  // PROFESSIONAL STAGE LAYOUT
  if (layoutMode === "stage" && screenShareTracks.length > 0) {
    const mainTrack = screenShareTracks[0];
    const otherTracks = cameraTracks;

    return (
      <div className="w-full h-full flex flex-col bg-[#FBF9FA] overflow-hidden relative">
        {/* Filmstrip (Top) */}
        {showFilmstrip && (
          <div className="h-24 md:h-40 flex-shrink-0 p-2 md:p-4 transition-all duration-300">
            <div className="flex gap-2 md:gap-4 h-full overflow-x-auto no-scrollbar justify-center">
              {otherTracks.map((track) => (
                <div key={`${track.participant.identity}_${track.source}`} className="h-full aspect-video flex-shrink-0 shadow-lg rounded-xl overflow-hidden border border-stone-200/80 bg-white">
                  <VideoTile trackRef={track} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Stage */}
        <div className="flex-1 min-h-0 p-2 md:p-4 pt-0 relative flex items-center justify-center overflow-hidden group">
          <div className="w-full h-full rounded-2xl md:rounded-3xl overflow-hidden shadow-xl bg-white border border-stone-200/80">
            <VideoTile trackRef={mainTrack} />
          </div>
          
          {/* Filmstrip Toggle */}
          <div className="absolute top-2 md:top-4 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowFilmstrip(!showFilmstrip)}
              className="p-1 rounded-full bg-white/90 text-stone-500 hover:text-stone-800 border border-stone-200 shadow-md backdrop-blur-md cursor-pointer"
            >
              {showFilmstrip ? <ChevronUp size={14} className="md:w-4 md:h-4" /> : <ChevronDown size={14} className="md:w-4 md:h-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#FBF9FA] flex flex-col overflow-hidden">
      <div className={cn(
        "flex-1 grid gap-1.5 md:gap-4 p-1.5 md:p-4",
        tracks.length === 1 ? "grid-cols-1 grid-rows-1" :
        tracks.length === 2 ? "grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1" :
        tracks.length <= 4 ? "grid-cols-2 grid-rows-2" :
        "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      )}>
        {tracks.map((track) => (
          <div key={`${track.participant.identity}_${track.source}`} className="w-full h-full relative overflow-hidden rounded-2xl bg-white border border-stone-200/85 shadow-md">
            <VideoTile trackRef={track} />
          </div>
        ))}
      </div>
    </div>
  );
}
