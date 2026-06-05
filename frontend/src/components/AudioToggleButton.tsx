"use client";

import { useStartAudio, useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function AudioToggleButton() {
  const { toggle, enabled } = useTrackToggle({ source: Track.Source.Microphone });
  // useStartAudio: resume the browser's AudioContext before toggling the mic.
  // On desktop the AudioContext is usually already running so this is a no-op.
  // On iOS/Android it MUST be called inside a user-gesture callback.
  const { mergedProps: audioProps, canPlayAudio } = useStartAudio({ props: {} });

  const handleClick = () => {
    // If AudioContext is still suspended (mobile browsers), resume it first.
    // audioProps.onClick is () => void — no event argument.
    if (!canPlayAudio) {
      audioProps.onClick?.();
    }
    toggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "p-2.5 md:p-4 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border",
        enabled
          ? "bg-white hover:bg-stone-50 text-[#c16d18] border-stone-200"
          : "bg-[#c16d18] text-white border-[#c16d18]"
      )}
      title={enabled ? "Mute Microphone" : "Unmute Microphone"}
    >
      {enabled ? <Mic size={20} className="md:w-6 md:h-6" /> : <MicOff size={20} className="md:w-6 md:h-6" />}
    </button>
  );
}
