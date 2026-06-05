"use client";

import { useStartAudio, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";

/**
 * MobileAudioGate
 *
 * On iOS Safari and Android Chrome, the Web Audio API AudioContext starts in a
 * "suspended" state and can only be resumed inside a user-gesture handler.
 * LiveKit's built-in <StartAudio> has the right logic but renders with a low
 * z-index that gets buried under our controls overlay on mobile.
 *
 * This component renders a full-screen tap target at z-[9999] so the user
 * cannot miss it. After a single tap, the AudioContext is resumed, remote
 * audio starts playing, and the overlay disappears.
 */
export function MobileAudioGate() {
  const room = useRoomContext();
  const { mergedProps, canPlayAudio } = useStartAudio({ props: {} });
  const [dismissed, setDismissed] = useState(false);

  const needsGate = !canPlayAudio && !dismissed;

  const handleTap = () => {
    // Call LiveKit's AudioContext resume handler (must be called inside a user gesture)
    mergedProps.onClick?.();

    // iOS quirk: audio elements attached before the user gesture stay silent.
    // Re-attach all remote audio tracks to force them to play.
    if (room) {
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((pub) => {
          const track = pub.audioTrack;
          if (track?.attachedElements) {
            track.attachedElements.forEach((el) => {
              const audioEl = el as HTMLAudioElement;
              const src = audioEl.srcObject;
              audioEl.srcObject = null;
              setTimeout(() => {
                audioEl.srcObject = src;
                audioEl.play().catch(() => {});
              }, 0);
            });
          }
        });
      });
    }

    setDismissed(true);
  };

  // Reset gate on reconnect (e.g. after phone sleep)
  useEffect(() => {
    if (!room) return;
    const onReconnected = () => setDismissed(false);
    room.on(RoomEvent.Reconnected, onReconnected);
    return () => { room.off(RoomEvent.Reconnected, onReconnected); };
  }, [room]);

  if (!needsGate) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-pointer select-none"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={handleTap}
    >
      <div className="flex flex-col items-center gap-4 text-white text-center px-8">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#c16d18]/40 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-[#c16d18] flex items-center justify-center shadow-2xl">
            <Volume2 size={36} className="text-white" />
          </div>
        </div>
        <h2 className="text-xl font-extrabold tracking-tight mt-2">
          Tap anywhere to enable audio
        </h2>
        <p className="text-sm text-white/70 max-w-xs">
          Your browser requires a tap before playing audio in meetings.
        </p>
      </div>
    </div>
  );
}
