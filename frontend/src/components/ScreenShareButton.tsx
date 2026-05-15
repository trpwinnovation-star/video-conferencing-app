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
        "p-2.5 md:p-4 rounded-full flex items-center justify-center transition-all",
        enabled 
          ? "bg-blue-600 hover:bg-blue-700 text-white" 
          : "bg-slate-800 hover:bg-slate-700 text-white"
      )}
      title={enabled ? "Stop Sharing" : "Share Screen"}
    >
      {enabled ? <MonitorOff size={20} className="md:w-6 md:h-6" /> : <MonitorUp size={20} className="md:w-6 md:h-6" />}
    </button>
  );
}
