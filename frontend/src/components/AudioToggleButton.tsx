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
        "p-4 rounded-full flex items-center justify-center transition-all",
        enabled
          ? "bg-slate-800 hover:bg-slate-700 text-white"
          : "bg-red-500 hover:bg-red-600 text-white"
      )}
      title={enabled ? "Mute Microphone" : "Unmute Microphone"}
    >
      {enabled ? <Mic size={24} /> : <MicOff size={24} />}
    </button>
  );
}
