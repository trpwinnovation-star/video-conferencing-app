"use client";

import React, { useState, useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { SwitchCamera } from "lucide-react";
import { cn } from "@/lib/utils";

export function CameraFlipButton() {
  const room = useRoomContext();
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  // Enumerate video devices on mount
  useEffect(() => {
    const enumerateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === "videoinput");
        setVideoDevices(videoInputs);
      } catch (err) {
        console.warn("[CameraFlip] Could not enumerate devices:", err);
      }
    };

    enumerateDevices();

    // Re-enumerate when devices change (e.g. user plugs in a camera)
    navigator.mediaDevices?.addEventListener("devicechange", enumerateDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", enumerateDevices);
    };
  }, []);

  // Only show if there are 2+ cameras
  if (videoDevices.length < 2) return null;

  const handleFlip = async () => {
    if (isFlipping) return;
    setIsFlipping(true);

    try {
      const nextIndex = (currentDeviceIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];

      await room.switchActiveDevice("videoinput", nextDevice.deviceId);
      setCurrentDeviceIndex(nextIndex);
    } catch (err) {
      console.error("[CameraFlip] Failed to switch camera:", err);
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
