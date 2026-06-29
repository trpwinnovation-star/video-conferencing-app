"use client";

import { useState } from "react";
import { useTrackToggle, useParticipants, useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";
import { MonitorUp, MonitorOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScreenShareButton() {
  const { toggle, enabled } = useTrackToggle({
    source: Track.Source.ScreenShare,
    captureOptions: {
      audio: true,
    },
  });

  const participants = useParticipants();
  const room = useRoomContext();
  const [showWarningModal, setShowWarningModal] = useState(false);

  // Find if any OTHER participant is currently sharing their screen
  const otherSharingParticipant = participants.find(
    (p) => p.identity !== room?.localParticipant?.identity && 
    (p.isScreenShareEnabled || p.getTrackPublication(Track.Source.ScreenShare) !== undefined)
  );

  const handleClick = () => {
    if (enabled) {
      // If we are currently sharing, allow turning it off
      toggle();
    } else if (otherSharingParticipant) {
      // If someone else is sharing, show Zoom/Google Meet style alert modal
      setShowWarningModal(true);
    } else {
      // No one else is sharing, proceed to share screen
      toggle();
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "p-2.5 md:p-4 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border",
          enabled 
            ? "bg-[#c16d18] hover:bg-[#a0560e] text-white border-[#c16d18]" 
            : "bg-white hover:bg-stone-50 text-[#c16d18] border-stone-200"
        )}
        title={enabled ? "Stop Sharing" : otherSharingParticipant ? "Someone is already sharing" : "Share Screen"}
      >
        {enabled ? <MonitorOff size={20} className="md:w-6 md:h-6" /> : <MonitorUp size={20} className="md:w-6 md:h-6" />}
      </button>

      {/* Zoom / Google Meet style warning modal */}
      {showWarningModal && otherSharingParticipant && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-xl border border-stone-200 text-stone-900 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mb-4 text-orange-500">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-xl font-extrabold text-stone-900 mb-2">
              Someone is already sharing
            </h3>
            <p className="text-stone-600 mb-6 text-sm leading-relaxed">
              <strong>{otherSharingParticipant.name || otherSharingParticipant.identity}</strong> is currently sharing their screen. To prevent confusion, only one person can share at a time. Please wait for them to stop before sharing your screen.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowWarningModal(false)}
                className="bg-[#c16d18] hover:bg-[#a0560e] text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
