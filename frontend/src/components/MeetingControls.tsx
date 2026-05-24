"use client";

import { useRoomContext } from "@livekit/components-react";
import { PhoneOff } from "lucide-react";
import { AudioToggleButton } from "./AudioToggleButton";
import { VideoToggleButton } from "./VideoToggleButton";
import { ScreenShareButton } from "./ScreenShareButton";
import { RecordingControls } from "./RecordingControls";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface MeetingControlsProps {
  roomName: string;
}

export function MeetingControls({ roomName }: MeetingControlsProps) {
  const room = useRoomContext();
  const router = useRouter();

  const handleLeave = async () => {
    try {
      if (room && room.state !== "disconnected") {
        await room.disconnect(true);
      }
    } catch (e) {
      // Ignore disconnect errors
    } finally {
      router.push("/");
    }
  };

  return (
    <div className="flex items-center gap-1 md:gap-3 bg-white/95 backdrop-blur-xl border border-stone-200/80 p-2 md:p-3 md:px-6 rounded-2xl md:rounded-3xl shadow-xl shadow-stone-300/40">
      <div className="flex flex-col items-center gap-1 group">
        <AudioToggleButton />
        <span className="hidden md:block text-[9px] font-bold text-stone-500 group-hover:text-[#c16d18] transition-colors uppercase tracking-wider">Mute</span>
      </div>
      
      <div className="flex flex-col items-center gap-1 group">
        <VideoToggleButton />
        <span className="hidden md:block text-[9px] font-bold text-stone-500 group-hover:text-[#c16d18] transition-colors uppercase tracking-wider">Video</span>
      </div>

      <div className="hidden md:block w-px h-10 bg-stone-200 mx-1" />

      <div className="flex flex-col items-center gap-1 group">
        <ScreenShareButton />
        <span className="hidden md:block text-[9px] font-bold text-stone-500 group-hover:text-[#c16d18] transition-colors uppercase tracking-wider">Share</span>
      </div>
      
      <div className="flex flex-col items-center gap-1 group">
        <RecordingControls roomName={roomName} />
        <span className="hidden md:block text-[9px] font-bold text-stone-500 group-hover:text-[#c16d18] transition-colors uppercase tracking-wider">Record</span>
      </div>
      
      <div className="hidden md:block w-px h-10 bg-stone-200 mx-1" />
      
      <div className="flex flex-col items-center gap-1 group">
        <button
          onClick={handleLeave}
          className="h-10 w-14 md:h-12 md:w-20 rounded-2xl flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all shadow-md shadow-red-200 active:scale-95 cursor-pointer border border-red-400"
        >
          <PhoneOff size={20} className="md:w-[22px] md:h-[22px]" />
        </button>
        <span className="hidden md:block text-[9px] font-bold text-red-500 group-hover:text-red-600 transition-colors uppercase tracking-wider">Leave</span>
      </div>
    </div>
  );
}
