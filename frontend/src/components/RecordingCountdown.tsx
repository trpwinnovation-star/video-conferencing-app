"use client";

import { Clock } from "lucide-react";

interface RecordingCountdownProps {
  recordingDuration: number;
  isRecording: boolean;
}

const MAX_RECORDING_SECONDS = 3600; // 1 hour
const COUNTDOWN_THRESHOLD = 300; // 5 minutes

export function RecordingCountdown({ recordingDuration, isRecording }: RecordingCountdownProps) {
  if (!isRecording) {
    return null;
  }

  const timeRemaining = MAX_RECORDING_SECONDS - recordingDuration;

  // Show countdown when less than 5 minutes (300 seconds) remain
  if (timeRemaining > COUNTDOWN_THRESHOLD || timeRemaining <= 0) {
    return null;
  }

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const displayTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // Calculate percentage for color intensity
  const percentageRemaining = (timeRemaining / COUNTDOWN_THRESHOLD) * 100;
  const isUrgent = percentageRemaining < 33; // Last 1.5 minutes

  return (
    <div
      className={`fixed bottom-32 left-6 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border-2 animate-in fade-in zoom-in-95 duration-300 font-bold text-base transition-all ${
        isUrgent
          ? "bg-red-100 border-red-500 text-red-700 shadow-red-400/50"
          : "bg-orange-100 border-orange-500 text-orange-700 shadow-orange-400/50"
      }`}
    >
      <Clock
        size={22}
        className={`shrink-0 ${isUrgent ? "animate-pulse" : "animate-bounce"}`}
      />
      <div className="flex flex-col">
        <span className="text-xs font-semibold opacity-75">Recording Time Left</span>
        <span className="text-lg font-mono tracking-wide">{displayTime}</span>
      </div>
    </div>
  );
}
