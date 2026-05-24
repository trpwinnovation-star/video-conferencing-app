"use client";

import { useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function AudioToggleButton() {
  const { toggle, enabled } = useTrackToggle({ source: Track.Source.Microphone });

  return (
    <button
      onClick={() => toggle()}
      className={cn(
        "p-2.5 md:p-4 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border",
        enabled
          ? "bg-white hover:bg-stone-50 text-[#c16d18] border-stone-200"
          : "bg-red-500 hover:bg-red-600 text-white border-red-400"
      )}
      title={enabled ? "Mute Microphone" : "Unmute Microphone"}
    >
      {enabled ? <Mic size={20} className="md:w-6 md:h-6" /> : <MicOff size={20} className="md:w-6 md:h-6" />}
    </button>
  );
}
