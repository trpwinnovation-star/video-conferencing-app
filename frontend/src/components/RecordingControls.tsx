"use client";

import { useState, useEffect } from "react";
import { Circle, Square, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRecording } from "@/hooks/useRecording";
import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { ChevronDown, Mic, MicOff } from "lucide-react";

interface RecordingControlsProps {
  roomName: string;
  userEmail?: string;
  userName?: string;
  onRecordStart?: () => void;
  onRecordingStateChange?: (isRecording: boolean, duration: number) => void;
  onRecordingReady?: (blob: Blob, duration: number) => void;
}

export function RecordingControls({ roomName, userEmail, userName, onRecordStart, onRecordingStateChange, onRecordingReady }: RecordingControlsProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [showModeMenu, setShowModeMenu] = useState(false);
  // New state to toggle audio recording
  const [recordAudio, setRecordAudio] = useState(true);
  
  // Get all active audio tracks in the room (microphones and screen share audio)
  const audioTracks = useTracks([Track.Source.Microphone, Track.Source.ScreenShareAudio]);

  const localRecorder = useRecording({
    roomName,
    // Use fallback values if not provided by parent component yet
    userEmail: userEmail || 'user@example.com',
    userName: userName || 'Local User',
    onSuccess: (path) => {
      setToastMessage("Local recording saved successfully!");
      setToastType("success");
      setShowToast(true);
    },
    onError: (err) => {
      setToastMessage(err);
      setToastType("error");
      setShowToast(true);
    },
    onWarning: (msg) => {
      setToastMessage(msg);
      setToastType("error");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 10000);
    },
    onRecordingReady: (blob, duration) => {
      onRecordingReady?.(blob, duration);
    }
  });

  // Auto-hide toast
  useEffect(() => {
    if (showToast) {
      // 3 seconds for start message, 5 seconds for success, 10 seconds for warning/error
      const duration = toastMessage === "Recording started!" ? 3000 : 5000;
      const timer = setTimeout(() => setShowToast(false), duration);
      return () => clearTimeout(timer);
    }
  }, [showToast, toastMessage]);

  // Notify parent of recording state changes
  useEffect(() => {
    onRecordingStateChange?.(localRecorder.isRecording, localRecorder.duration);
  }, [localRecorder.isRecording, localRecorder.duration, onRecordingStateChange]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleLocalRecording = () => {
    if (localRecorder.isRecording) {
      localRecorder.stopRecording();
    } else {
      // Extract all underlying MediaStreamTracks
      let mediaStreamTracks: MediaStreamTrack[] = [];
      
      if (recordAudio) {
        mediaStreamTracks = audioTracks
          .map(t => t.publication?.track?.mediaStreamTrack)
          .filter((t): t is MediaStreamTrack => t !== undefined);
      }
      
      localRecorder.startRecording(mediaStreamTracks);
      setToastMessage("Recording started!");
      setToastType("success");
      setShowToast(true);
      onRecordStart?.();
    }
  };

  const isAnyRecording = localRecorder.isRecording;
  const isAnyProcessing = localRecorder.isUploading;
  const currentDuration = localRecorder.duration;

  return (
    <div className="relative flex flex-col items-center">
      {/* Toast Notification */}
      {showToast && (
        <div className={cn(
          "absolute -top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-300 border z-[100]",
          toastType === "success"
            ? "bg-green-50 text-green-800 border-green-200"
            : "bg-red-50 text-red-800 border-red-200"
        )}>
          {toastType === "success" ? <CheckCircle2 size={16} className="text-green-600" /> : <AlertCircle size={16} className="text-red-600" />}
          <span className="text-xs font-bold flex-1 pr-2">{toastMessage}</span>
          <button 
            onClick={() => setShowToast(false)}
            className="p-0.5 rounded-full hover:bg-stone-200/50 transition-colors"
          >
            <X size={14} className="opacity-70 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Recording Timer Badge */}
      {isAnyRecording && (
        <div className="absolute -top-10 md:-top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white border border-stone-200 shadow-md px-2 py-0.5 md:px-3 md:py-1 rounded-full">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#c16d18] animate-pulse" />
          <span className="text-[10px] md:text-xs font-mono text-[#c16d18] font-extrabold">
            LOCAL {formatDuration(currentDuration)}
          </span>
        </div>
      )}

      {/* Processing Status */}
      {isAnyProcessing && (
        <div className="absolute -top-10 md:-top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#c16d18]/10 border border-[#c16d18]/20 px-3 py-1 rounded-full text-[#c16d18]">
          <Loader2 size={13} className="animate-spin" />
          <span className="text-[10px] md:text-xs font-bold">Processing...</span>
        </div>
      )}

      <div className="flex items-center">
        {/* Main Record Toggle Button */}
        <button
          onClick={toggleLocalRecording}
          disabled={isAnyProcessing}
          className={cn(
            "h-10 w-10 md:h-12 md:w-12 rounded-l-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border",
            isAnyRecording
              ? "bg-[#c16d18] hover:bg-[#a0560e] text-white border-[#c16d18] animate-pulse"
              : "bg-white hover:bg-stone-50 text-[#c16d18] border-stone-200",
            isAnyProcessing && "opacity-50 cursor-not-allowed"
          )}
          title={isAnyRecording ? "Stop Recording" : "Start Recording"}
        >
          {isAnyProcessing ? (
            <Loader2 size={18} className="animate-spin md:w-5 md:h-5" />
          ) : isAnyRecording ? (
            <Square size={16} className="fill-current md:w-[18px] md:h-[18px]" />
          ) : (
            <Circle size={16} className="fill-current md:w-[18px] md:h-[18px]" />
          )}
        </button>

        {/* Mode Selector Chevron */}
        <div className="relative">
          <button
            onClick={() => !isAnyRecording && setShowModeMenu(!showModeMenu)}
            disabled={isAnyRecording || isAnyProcessing}
            className={cn(
              "h-10 w-6 md:h-12 md:w-8 rounded-r-2xl flex items-center justify-center bg-stone-100 hover:bg-stone-200 text-stone-500 border-l border-stone-200 border-t border-b border-r border-stone-200 transition-all cursor-pointer",
              isAnyRecording && "opacity-40 cursor-not-allowed"
            )}
          >
            <ChevronDown size={13} className={cn("transition-transform duration-200", showModeMenu && "rotate-180")} />
          </button>

          {/* Dropdown Menu */}
          {showModeMenu && (
            <div className="absolute bottom-full mb-2 right-0 bg-white border border-stone-200/80 rounded-2xl p-1.5 shadow-2xl shadow-stone-200/60 min-w-[170px] animate-in fade-in slide-in-from-bottom-2 duration-200 z-[100]">
              {/* Audio Options */}
              <button
                onClick={() => setRecordAudio(!recordAudio)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-stone-600 hover:bg-stone-50 cursor-pointer"
                title="Toggle audio recording"
              >
                {recordAudio
                  ? <Mic size={15} className="text-green-600" />
                  : <MicOff size={15} className="text-red-500" />}
                <span>{recordAudio ? "Audio Included" : "No Audio"}</span>
                <div className={cn(
                  "ml-auto w-8 h-4 rounded-full transition-colors flex items-center px-0.5",
                  recordAudio ? "bg-green-500" : "bg-stone-200"
                )}>
                  <div className={cn(
                    "w-3 h-3 rounded-full bg-white shadow-sm transition-transform",
                    recordAudio ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
