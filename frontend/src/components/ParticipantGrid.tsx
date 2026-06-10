"use client";

import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { VideoTile } from "./VideoTile";
import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Monitor, PinOff } from "lucide-react";
import { useRoomPin } from "@/contexts/RoomPinContext";


export function ParticipantGrid() {
  const { pinnedIdentity, unpinParticipant } = useRoomPin();

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

  const [showFilmstrip, setShowFilmstrip] = useState(true);

  const pinnedTrack = useMemo(() => {
    if (!pinnedIdentity) return null;
    return cameraTracks.find((t) => t.participant.identity === pinnedIdentity) ?? null;
  }, [cameraTracks, pinnedIdentity]);

  // Clear pin if pinned participant left
  useEffect(() => {
    if (pinnedIdentity && !cameraTracks.some((t) => t.participant.identity === pinnedIdentity)) {
      unpinParticipant();
    }
  }, [pinnedIdentity, cameraTracks, unpinParticipant]);

  if (tracks.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 font-medium animate-pulse">
        <Monitor size={48} className="mb-4 text-[#c16d18] opacity-35" />
        <p className="font-semibold text-stone-600">Connecting to room...</p>
      </div>
    );
  }

  // Screen share takes priority over pin
  if (screenShareTracks.length > 0) {
    const mainTrack = screenShareTracks[0];
    const otherTracks = cameraTracks;

    return (
      <div className="w-full h-full flex flex-col md:flex-row gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl md:rounded-3xl overflow-hidden bg-[#FBF9FA] border border-stone-200/80 p-2 md:p-3 relative group">
        {/* Main Track (Screen Share) */}
        <div className="flex-1 relative rounded-xl sm:rounded-2xl overflow-hidden h-full bg-white border border-stone-200/80 shadow-sm">
          <VideoTile trackRef={mainTrack} />
        </div>

        {/* Partitioned Filmstrip (Side panel on desktop, bottom panel on mobile) */}
        {showFilmstrip && otherTracks.length > 0 && (
          <div className="w-full md:w-44 lg:w-52 xl:w-60 flex-shrink-0 flex md:flex-col gap-2 md:gap-3 overflow-x-auto md:overflow-y-auto no-scrollbar p-1 max-h-[100px] md:max-h-none h-auto md:h-full justify-center items-center">
            {otherTracks.map((track) => (
              <div
                key={`${track.participant.identity}_${track.source}`}
                className="w-24 sm:w-28 md:w-full aspect-video flex-shrink-0 rounded-lg sm:rounded-xl overflow-hidden shadow-md border border-stone-200/80 bg-white hover:scale-[1.02] transition-transform"
              >
                <VideoTile trackRef={track} />
              </div>
            ))}
          </div>
        )}

        {/* Toggle filmstrip button */}
        {otherTracks.length > 0 && (
          <div className="absolute top-4 right-4 z-30 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={() => setShowFilmstrip(!showFilmstrip)}
              className="px-3 py-1.5 rounded-xl bg-[#c16d18] hover:bg-[#965310] text-white text-xs font-bold transition-all shadow-md cursor-pointer border-none flex items-center gap-1.5"
              title={showFilmstrip ? "Hide participants" : "Show participants"}
            >
              {showFilmstrip ? "Hide People" : "Show People"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Pinned participant spotlight (Zoom-style)
  if (pinnedTrack && cameraTracks.length > 1) {
    const filmstripTracks = cameraTracks.filter(
      (t) => t.participant.identity !== pinnedIdentity
    );

    return (
      <div className="w-full h-full flex flex-col md:flex-row gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl md:rounded-3xl overflow-hidden bg-[#FBF9FA] border border-stone-200/80 p-2 md:p-3 relative group">
        {/* Main Pinned Track */}
        <div className="flex-1 relative rounded-xl sm:rounded-2xl overflow-hidden h-full bg-white border border-stone-200/80 shadow-sm">
          <VideoTile trackRef={pinnedTrack} isPinned />
          
          {/* Explicit Unpin Button — always visible */}
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-40">
            <button
              onClick={() => unpinParticipant()}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white/85 hover:bg-white text-stone-700 text-[10px] sm:text-xs font-bold backdrop-blur-md shadow-lg transition-all active:scale-95 cursor-pointer border border-stone-200"
            >
              <PinOff size={12} className="sm:w-3.5 sm:h-3.5" />
              <span>Unpin</span>
            </button>
          </div>
        </div>

        {/* Partitioned Filmstrip (Side panel on desktop, bottom panel on mobile) */}
        {showFilmstrip && filmstripTracks.length > 0 && (
          <div className="w-full md:w-44 lg:w-52 xl:w-60 flex-shrink-0 flex md:flex-col gap-2 md:gap-3 overflow-x-auto md:overflow-y-auto no-scrollbar p-1 max-h-[100px] md:max-h-none h-auto md:h-full justify-center items-center">
            {filmstripTracks.map((track) => (
              <div
                key={`${track.participant.identity}_${track.source}`}
                className="w-24 sm:w-28 md:w-full aspect-video flex-shrink-0 rounded-lg sm:rounded-xl overflow-hidden shadow-md border border-stone-200/80 bg-white hover:scale-[1.02] transition-transform"
              >
                <VideoTile trackRef={track} />
              </div>
            ))}
          </div>
        )}

        {/* Toggle filmstrip button */}
        {filmstripTracks.length > 0 && (
          <div className="absolute top-4 right-4 z-30 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={() => setShowFilmstrip(!showFilmstrip)}
              className="px-3 py-1.5 rounded-xl bg-[#c16d18] hover:bg-[#965310] text-white text-xs font-bold transition-all shadow-md cursor-pointer border-none flex items-center gap-1.5"
              title={showFilmstrip ? "Hide participants" : "Show participants"}
            >
              {showFilmstrip ? "Hide People" : "Show People"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // === DEFAULT GRID — Zoom/Meet-style equal tiles ===
  const count = cameraTracks.length;

  // Compute the grid class based on participant count for professional equal sizing
  const getGridClass = () => {
    switch (count) {
      case 1:
        // Single participant — takes full screen
        return "grid grid-cols-1";
      case 2:
        // 2 participants — stacked mobile, side by side desktop
        return "grid grid-cols-1 md:grid-cols-2";
      case 3:
        // 3 participants — stacked mobile, 3 cols desktop
        return "grid grid-cols-1 md:grid-cols-3";
      case 4:
        // 4 participants — perfect 2×2 grid everywhere
        return "grid grid-cols-2";
      case 5:
      case 6:
        // 5-6 participants — 2 cols mobile, 3 cols desktop
        return "grid grid-cols-2 lg:grid-cols-3";
      default:
        // 7+ participants — auto-fill responsive
        return "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    }
  };

  // Default grid for all participants, fully responsive
  return (
    <div className="h-full w-full bg-[#FBF9FA] flex flex-col overflow-hidden">
      <div
        className={cn(
          "flex-1 gap-1.5 sm:gap-2 md:gap-3 p-1.5 sm:p-2 md:p-3 auto-rows-fr",
          getGridClass()
        )}
        style={{ minHeight: 0 }}
      >
        {cameraTracks.map((track) => (
          <div
            key={`${track.participant.identity}_${track.source}`}
            className="w-full h-full relative overflow-hidden rounded-xl sm:rounded-2xl bg-white border border-stone-200/85 shadow-md min-h-0"
          >
            <VideoTile
              trackRef={track}
              isPinned={track.participant.identity === pinnedIdentity}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
