"use client";

import { useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Video, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function VideoToggleButton() {
  const { toggle, enabled } = useTrackToggle({ source: Track.Source.Camera });

  return (
    <button
      onClick={() => toggle()}
      className={cn(
        "p-4 rounded-full flex items-center justify-center transition-all",
        enabled 
          ? "bg-slate-800 hover:bg-slate-700 text-white" 
          : "bg-red-500 hover:bg-red-600 text-white"
      )}
      title={enabled ? "Turn off Camera" : "Turn on Camera"}
    >
      {enabled ? <Video size={24} /> : <VideoOff size={24} />}
    </button>
  );
}
