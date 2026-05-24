"use client";

import { useParticipants } from "@livekit/components-react";
import { Users } from "lucide-react";

interface RoomHeaderProps {
  roomName: string;
}

export function RoomHeader({ roomName }: RoomHeaderProps) {
  const participants = useParticipants();

  return (
    <div className="h-16 w-full flex items-center justify-between px-6 bg-white border-b border-stone-200/80 shadow-sm text-stone-900">
      <div className="flex items-center gap-3">
        <div className="bg-[#c16d18] text-white px-4.5 py-2 rounded-xl text-sm font-bold shadow-md shadow-[#c16d18]/20">
          Room: {roomName}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-[#FBF9FA] text-stone-800 px-4 py-2 rounded-xl border border-stone-200/80 shadow-sm">
          <Users size={16} className="text-[#c16d18]" />
          <span className="text-sm font-bold">{participants.length}</span>
        </div>
      </div>
    </div>
  );
}
