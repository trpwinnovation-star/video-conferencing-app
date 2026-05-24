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
        "p-2.5 md:p-4 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border",
        enabled 
          ? "bg-[#c16d18] hover:bg-[#a0560e] text-white border-[#c16d18]" 
          : "bg-white hover:bg-stone-50 text-[#c16d18] border-stone-200"
      )}
      title={enabled ? "Stop Sharing" : "Share Screen"}
    >
      {enabled ? <MonitorOff size={20} className="md:w-6 md:h-6" /> : <MonitorUp size={20} className="md:w-6 md:h-6" />}
    </button>
  );
}
