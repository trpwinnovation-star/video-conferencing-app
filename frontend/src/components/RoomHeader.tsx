"use client";

import { useParticipants } from "@livekit/components-react";
import { Users, ChevronDown, Copy, Check } from "lucide-react";

import { ShareRoomButton } from "./ShareRoomButton";
import { useState } from "react";

interface RoomHeaderProps {
  roomName: string;
}

export function RoomHeader({ roomName }: RoomHeaderProps) {
  const participants = useParticipants();
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [copied, setCopied] = useState(false);


  return (
    <div className="h-14 sm:h-16 w-full flex items-center justify-between px-2 sm:px-4 md:px-6 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-sm text-stone-900">
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
        <div className="bg-[#c16d18] text-white px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs md:text-sm font-bold shadow-md shadow-[#c16d18]/20 font-mono flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="hidden md:inline">Meeting ID :</span>
          <span className="truncate max-w-[90px] sm:max-w-[160px] md:max-w-none">{roomName}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(roomName).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className={`shrink-0 p-0.5 sm:p-1 rounded transition-transform duration-200 ${copied ? "bg-green-600" : "bg-white/20 hover:bg-white/30"}`}
            aria-label="Copy room ID"
          >
            {copied ? <Check size={12} className="sm:w-3.5 sm:h-3.5 text-white" /> : <Copy size={12} className="sm:w-3.5 sm:h-3.5 text-white" />}
          </button>
        </div>
        <div className="block shrink-0">
          <ShareRoomButton roomId={roomName} />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 relative shrink-0">
        <button
          onClick={() => setShowParticipantsList(!showParticipantsList)}
          onMouseEnter={() => setShowParticipantsList(true)}
          className="flex items-center gap-1.5 sm:gap-2 bg-[#FBF9FA] text-stone-800 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-stone-200/80 shadow-sm hover:bg-stone-50 transition-colors cursor-pointer"
        >
          <Users size={14} className="sm:w-4 sm:h-4 text-[#c16d18]" />
          <span className="text-xs sm:text-sm font-bold">{participants.length}</span>
          <ChevronDown size={12} className={`sm:w-3.5 sm:h-3.5 text-stone-500 transition-transform ${showParticipantsList ? 'rotate-180' : ''}`} />
        </button>

        {/* Participants Dropdown */}
        {showParticipantsList && (
          <div
            className="absolute top-full mt-2 right-0 bg-white border border-stone-200/80 rounded-xl shadow-lg z-50 w-[260px] sm:min-w-[280px] animate-in fade-in slide-in-from-top-2 duration-200"
            onMouseLeave={() => setShowParticipantsList(false)}
          >
            <div className="p-3 border-b border-stone-100">
              <h3 className="text-xs sm:text-sm font-bold text-stone-800">
                Participants ({participants.length})
              </h3>
            </div>

            <div className="max-h-[300px] sm:max-h-[400px] overflow-y-auto">
              {participants.length === 0 ? (
                <div className="p-4 text-center text-stone-400 text-sm">
                  No participants yet
                </div>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {participants.map((participant) => (
                    <li key={participant.identity} className="p-2.5 sm:p-3 hover:bg-stone-50 flex items-center gap-2.5 sm:gap-3">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#c16d18]/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] sm:text-xs font-bold text-[#c16d18]">
                          {participant.name?.[0]?.toUpperCase() || participant.identity[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-stone-800 truncate">
                          {participant.name || participant.identity}
                        </p>
                      </div>
                      {participant.isCameraEnabled && (
                        <span className="text-[10px] sm:text-xs bg-green-100 text-green-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shrink-0">
                          Camera
                        </span>
                      )}
                      {participant.isMicrophoneEnabled && (
                        <span className="text-[10px] sm:text-xs bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shrink-0">
                          Mic
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
