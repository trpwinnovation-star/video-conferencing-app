"use client";

import { useParticipants } from "@livekit/components-react";
import { Users } from "lucide-react";

interface RoomHeaderProps {
  roomName: string;
}

export function RoomHeader({ roomName }: RoomHeaderProps) {
  const participants = useParticipants();

  return (
    <div className="h-16 w-full flex items-center justify-between px-6 bg-slate-900 border-b border-white/10 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-lg">
          Room: {roomName}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-800 text-slate-100 px-4 py-1.5 rounded-full border border-white/10">
          <Users size={16} className="text-blue-400" />
          <span className="text-sm font-bold">{participants.length}</span>
        </div>
      </div>
    </div>
  );
}
