"use client";

import React, { useState, useEffect } from "react";
import { useLocalParticipant, useMediaDeviceSelect } from "@livekit/components-react";
import { SwitchCamera } from "lucide-react";
import { cn } from "@/lib/utils";

export function CameraFlipButton() {
  const { localParticipant } = useLocalParticipant();
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind: 'videoinput' });
  const [isFlipping, setIsFlipping] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  // Only show on mobile, only when camera is ON, and only if there's more than 1 camera detected
  if (!isMobile || !localParticipant?.isCameraEnabled || devices.length < 2) return null;

  const handleFlip = async () => {
    if (isFlipping || !localParticipant || !localParticipant.isCameraEnabled) return;
    setIsFlipping(true);

    try {
      const currentIndex = devices.findIndex((d) => d.deviceId === activeDeviceId);
      // If we can't find current, just switch to the first alternative device
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % devices.length : 1;
      
      await setActiveMediaDevice(devices[nextIndex].deviceId);
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
