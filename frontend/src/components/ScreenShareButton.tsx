"use client";

import { useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { MonitorUp, MonitorOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScreenShareButton() {
  const { toggle, enabled } = useTrackToggle({ source: Track.Source.ScreenShare });

  return (
    <button
      onClick={() => toggle()}
      className={cn(
        "p-4 rounded-full flex items-center justify-center transition-all",
        enabled 
          ? "bg-blue-600 hover:bg-blue-700 text-white" 
          : "bg-slate-800 hover:bg-slate-700 text-white"
      )}
      title={enabled ? "Stop Sharing" : "Share Screen"}
    >
      {enabled ? <MonitorOff size={24} /> : <MonitorUp size={24} />}
    </button>
  );
}
