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
        "p-2.5 md:p-4 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border",
        enabled
          ? "bg-white hover:bg-stone-50 text-[#c16d18] border-stone-200"
          : "bg-[#c16d18] text-white"
      )}
      title={enabled ? "Turn off Camera" : "Turn on Camera"}
    >
      {enabled ? <Video size={20} className="md:w-6 md:h-6" /> : <VideoOff size={20} className="md:w-6 md:h-6" />}
    </button>
  );
}
