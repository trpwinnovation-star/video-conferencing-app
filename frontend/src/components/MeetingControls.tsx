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
    <div className="flex items-center gap-4 bg-slate-800 border-2 border-white/20 p-4 px-8 rounded-[2.5rem] shadow-2xl">
      <div className="flex flex-col items-center gap-1 group">
        <AudioToggleButton />
        <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors uppercase">Mute</span>
      </div>
      
      <div className="flex flex-col items-center gap-1 group">
        <VideoToggleButton />
        <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors uppercase">Video</span>
      </div>

      <div className="w-px h-10 bg-white/10 mx-2" />

      <div className="flex flex-col items-center gap-1 group">
        <ScreenShareButton />
        <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors uppercase">Share</span>
      </div>
      
      <div className="flex flex-col items-center gap-1 group">
        <RecordingControls roomName={roomName} />
        <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors uppercase">Record</span>
      </div>
      
      <div className="w-px h-10 bg-white/10 mx-2" />
      
      <div className="flex flex-col items-center gap-1 group">
        <button
          onClick={handleLeave}
          className="h-12 w-20 rounded-2xl flex items-center justify-center bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg active:scale-95"
        >
          <PhoneOff size={22} />
        </button>
        <span className="text-[10px] font-bold text-red-500 group-hover:text-red-400 transition-colors uppercase">Leave</span>
      </div>
    </div>
  );
}
