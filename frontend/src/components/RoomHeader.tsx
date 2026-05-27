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
    <div className="h-16 w-full flex items-center justify-between px-6 bg-white border-b border-stone-200/80 shadow-sm text-stone-900">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="bg-[#c16d18] text-white px-3 sm:px-4.5 py-2 rounded-xl text-sm font-bold shadow-md shadow-[#c16d18]/20 font-mono flex items-center gap-2">
          {roomName}
          <button
            onClick={() => {
              navigator.clipboard.writeText(roomName).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className={`ml-2 p-1 rounded transition-transform duration-200 ${copied ? "bg-green-600" : "bg-white/20 hover:bg-white/30"}`}
            aria-label="Copy room ID"
          >
            {copied ? <Check size={14} className="text-white" /> : <Copy size={14} className="text-white" />}
          </button>
        </div>
        <ShareRoomButton roomId={roomName} />
      </div>

      <div className="flex items-center gap-4 relative">
        <button
          onClick={() => setShowParticipantsList(!showParticipantsList)}
          onMouseEnter={() => setShowParticipantsList(true)}
          className="flex items-center gap-2 bg-[#FBF9FA] text-stone-800 px-4 py-2 rounded-xl border border-stone-200/80 shadow-sm hover:bg-stone-50 transition-colors cursor-pointer"
        >
          <Users size={16} className="text-[#c16d18]" />
          <span className="text-sm font-bold">{participants.length}</span>
          <ChevronDown size={14} className={`text-stone-500 transition-transform ${showParticipantsList ? 'rotate-180' : ''}`} />
        </button>

        {/* Participants Dropdown */}
        {showParticipantsList && (
          <div
            className="absolute top-full mt-2 right-0 bg-white border border-stone-200/80 rounded-xl shadow-lg z-50 min-w-[280px] animate-in fade-in slide-in-from-top-2 duration-200"
            onMouseLeave={() => setShowParticipantsList(false)}
          >
            <div className="p-3 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-800">
                Participants ({participants.length})
              </h3>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {participants.length === 0 ? (
                <div className="p-4 text-center text-stone-400 text-sm">
                  No participants yet
                </div>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {participants.map((participant) => (
                    <li key={participant.identity} className="p-3 hover:bg-stone-50 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#c16d18]/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-[#c16d18]">
                          {participant.name?.[0]?.toUpperCase() || participant.identity[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-800 truncate">
                          {participant.name || participant.identity}
                        </p>
                        <p className="text-xs text-stone-400">
                          {participant.isSpeaking ? '🔴 Speaking' : 'Idle'}
                        </p>
                      </div>
                      {participant.isCameraEnabled && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Camera
                        </span>
                      )}
                      {participant.isMicrophoneEnabled && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
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
