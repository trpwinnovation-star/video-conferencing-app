"use client";

import { Clock, Video, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface RecordingCountdownProps {
  recordingDuration: number;
  isRecording: boolean;
  meetingDetails?: any;
  isHost?: boolean;
}

const MAX_RECORDING_SECONDS = 3600; // 1 hour
const RECORDING_COUNTDOWN_THRESHOLD = 300; // 5 minutes
const MEETING_COUNTDOWN_THRESHOLD = 600; // 10 minutes

export function RecordingCountdown({ recordingDuration, isRecording, meetingDetails, isHost }: RecordingCountdownProps) {
  const [meetingTimeRemaining, setMeetingTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!meetingDetails || !meetingDetails.scheduledTime || !meetingDetails.durationMinutes || !isHost) {
      setMeetingTimeRemaining(null);
      return;
    }

    const calculateRemaining = () => {
      const startTime = new Date(meetingDetails.scheduledTime).getTime();
      const endTime = startTime + (meetingDetails.durationMinutes * 60 * 1000);
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setMeetingTimeRemaining(remaining);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [meetingDetails, isHost]);

  const recordingTimeRemaining = MAX_RECORDING_SECONDS - recordingDuration;
  const showRecordingTimer = isRecording && recordingTimeRemaining <= RECORDING_COUNTDOWN_THRESHOLD && recordingTimeRemaining > 0;

  const showMeetingTimer = isHost && meetingTimeRemaining !== null && meetingTimeRemaining <= MEETING_COUNTDOWN_THRESHOLD && meetingTimeRemaining > 0;

  if (!showRecordingTimer && !showMeetingTimer) {
    return null;
  }

  return (
    <div className="fixed bottom-32 left-6 flex flex-col gap-3 z-50">
      {/* Meeting End Timer */}
      {showMeetingTimer && (
        <TimerBox
          timeRemaining={meetingTimeRemaining!}
          threshold={MEETING_COUNTDOWN_THRESHOLD}
          label="Meeting Ends In"
          icon={<Users size={22} />}
          isUrgentThreshold={120} // 2 mins
        />
      )}

      {/* Recording End Timer */}
      {showRecordingTimer && (
        <TimerBox
          timeRemaining={recordingTimeRemaining}
          threshold={RECORDING_COUNTDOWN_THRESHOLD}
          label="Recording Ends In"
          icon={<Video size={22} />}
          isUrgentThreshold={60} // 1 min
        />
      )}
    </div>
  );
}

function TimerBox({ timeRemaining, threshold, label, icon, isUrgentThreshold }: { timeRemaining: number, threshold: number, label: string, icon: React.ReactNode, isUrgentThreshold: number }) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const displayTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const isUrgent = timeRemaining < isUrgentThreshold;

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border-2 animate-in fade-in zoom-in-95 duration-300 font-bold text-base transition-all ${isUrgent
          ? "bg-red-100 border-red-500 text-red-700 shadow-red-400/50"
          : "bg-orange-100 border-orange-500 text-orange-700 shadow-orange-400/50"
        }`}
    >
      <div className={`shrink-0 ${isUrgent ? "animate-pulse text-red-600" : "animate-bounce text-orange-600"}`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold opacity-75">{label}</span>
        <span className="text-lg font-mono tracking-wide">{displayTime}</span>
      </div>
    </div>
  );
}
