"use client";

import React, { useState, useEffect } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { SwitchCamera } from "lucide-react";
import { cn } from "@/lib/utils";

export function CameraFlipButton() {
  const { localParticipant } = useLocalParticipant();
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isFlipping, setIsFlipping] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  // Only show on mobile devices where facingMode is fully supported, AND only when camera is actually ON
  if (!isMobile || !localParticipant?.isCameraEnabled) return null;

  const handleFlip = async () => {
    if (isFlipping || !localParticipant || !localParticipant.isCameraEnabled) return;
    setIsFlipping(true);

    try {
      const nextMode = facingMode === "user" ? "environment" : "user";
      
      // Turn off current camera
      await localParticipant.setCameraEnabled(false);
      
      // Turn it back on requesting the opposite camera
      await localParticipant.setCameraEnabled(true, { facingMode: nextMode });
      
      setFacingMode(nextMode);
    } catch (err) {
      console.error("[CameraFlip] Failed to flip camera:", err);
    } finally {
      setIsFlipping(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1 group">
      <button
        onClick={handleFlip}
        disabled={isFlipping}
        className={cn(
          "p-2.5 md:p-4 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border",
          "bg-white hover:bg-stone-50 text-[#c16d18] border-stone-200",
          isFlipping && "opacity-50 cursor-not-allowed"
        )}
        title="Flip Camera"
      >
        <SwitchCamera size={20} className={cn("md:w-6 md:h-6", isFlipping && "animate-spin")} />
      </button>
      <span className="hidden md:block text-[9px] font-bold text-stone-500 group-hover:text-[#c16d18] transition-colors uppercase tracking-wider">
        Flip
      </span>
    </div>
  );
}
