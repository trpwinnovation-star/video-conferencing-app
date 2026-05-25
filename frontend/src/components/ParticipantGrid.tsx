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
      <div className="w-full h-full flex flex-col bg-[#FBF9FA] overflow-hidden relative">
        {showFilmstrip && otherTracks.length > 0 && (
          <div className="h-24 md:h-40 flex-shrink-0 p-2 md:p-4 transition-all duration-300">
            <div className="flex gap-2 md:gap-4 h-full overflow-x-auto no-scrollbar justify-center">
              {otherTracks.map((track) => (
                <div
                  key={`${track.participant.identity}_${track.source}`}
                  className="h-full aspect-video flex-shrink-0 shadow-lg rounded-xl overflow-hidden border border-stone-200/80 bg-white"
                >
                  <VideoTile trackRef={track} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 p-2 md:p-4 pt-0 relative flex items-center justify-center overflow-hidden group">
          <div className="w-full h-full rounded-2xl md:rounded-3xl overflow-hidden shadow-xl bg-white border border-stone-200/80">
            <VideoTile trackRef={mainTrack} />
          </div>

          {otherTracks.length > 0 && (
            <div className="absolute top-2 md:top-4 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setShowFilmstrip(!showFilmstrip)}
                className="p-1 rounded-full bg-white/90 text-stone-500 hover:text-stone-800 border border-stone-200 shadow-md backdrop-blur-md cursor-pointer"
              >
                {showFilmstrip ? (
                  <ChevronUp size={14} className="md:w-4 md:h-4" />
                ) : (
                  <ChevronDown size={14} className="md:w-4 md:h-4" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Pinned participant spotlight (Zoom-style)
  if (pinnedTrack && cameraTracks.length > 1) {
    const filmstripTracks = cameraTracks.filter(
      (t) => t.participant.identity !== pinnedIdentity
    );

    return (
      <div className="w-full h-full flex flex-col bg-[#FBF9FA] overflow-hidden relative">
        {showFilmstrip && filmstripTracks.length > 0 && (
          <div className="h-24 md:h-36 flex-shrink-0 p-2 md:p-3">
            <div className="flex gap-2 md:gap-3 h-full overflow-x-auto no-scrollbar justify-center">
              {filmstripTracks.map((track) => (
                <div
                  key={`${track.participant.identity}_${track.source}`}
                  className="h-full aspect-video flex-shrink-0 rounded-xl overflow-hidden border border-stone-200/80 bg-white shadow-md"
                >
                  <VideoTile trackRef={track} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 p-2 md:p-4 pt-0 relative flex items-center justify-center overflow-hidden group">
          <div className="w-full h-full rounded-2xl md:rounded-3xl overflow-hidden shadow-xl bg-white border-2 border-[#c16d18]/30 ring-2 ring-[#c16d18]/10">
            <VideoTile trackRef={pinnedTrack} isPinned />
          </div>

          <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
            <span className="bg-[#c16d18] text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-md">
              Pinned
            </span>
            <button
              onClick={unpinParticipant}
              className="flex items-center gap-1 bg-white/95 border border-stone-200 text-stone-600 hover:text-[#c16d18] px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm cursor-pointer"
            >
              <PinOff size={12} />
              Unpin
            </button>
          </div>

          {filmstripTracks.length > 0 && (
            <div className="absolute top-2 md:top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setShowFilmstrip(!showFilmstrip)}
                className="p-1 rounded-full bg-white/90 text-stone-500 hover:text-stone-800 border border-stone-200 shadow-md cursor-pointer"
              >
                {showFilmstrip ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default grid
  return (
    <div className="h-full w-full bg-[#FBF9FA] flex flex-col overflow-hidden">
      <div
        className={cn(
          "flex-1 grid gap-1.5 md:gap-4 p-1.5 md:p-4",
          cameraTracks.length === 1
            ? "grid-cols-1 grid-rows-1"
            : cameraTracks.length === 2
              ? "grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1"
              : cameraTracks.length <= 4
                ? "grid-cols-2 grid-rows-2"
                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        )}
      >
        {cameraTracks.map((track) => (
          <div
            key={`${track.participant.identity}_${track.source}`}
            className="w-full h-full relative overflow-hidden rounded-2xl bg-white border border-stone-200/85 shadow-md"
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
