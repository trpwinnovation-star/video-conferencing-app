"use client";

import { useState, useEffect } from "react";
import { Circle, Square, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { startRecording, stopRecording } from "@/lib/api";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";

interface RecordingControlsProps {
  roomName: string;
}

export function RecordingControls({ roomName }: RecordingControlsProps) {
  const { localParticipant } = useLocalParticipant();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  
  // State for server-side recording
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [egressId, setEgressId] = useState<string | null>(null);

  // Timer logic for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Auto-hide toast
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleRecording = async () => {
    try {
      setIsUploading(true);
      if (isRecording && egressId) {
        // Stop Egress recording
        await stopRecording(egressId);
        setIsRecording(false);
        setEgressId(null);
        setToastMessage("Recording stopped. File is being processed on server.");
        setToastType("success");
        setShowToast(true);
      } else {
        // Start Egress recording
        const res = await startRecording(roomName);
        if (res.egressId) {
          setEgressId(res.egressId);
          setIsRecording(true);
          setToastMessage("Server-side recording started!");
          setToastType("success");
          setShowToast(true);
        }
      }
    } catch (error: any) {
      console.error("Recording error:", error);
      setToastMessage(error.message || "Recording operation failed");
      setToastType("error");
      setShowToast(true);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Toast Notification */}
      {showToast && (
        <div className={cn(
          "absolute -top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-300",
          toastType === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        )}>
          {toastType === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Recording Info */}
      {isRecording && (
        <div className="absolute -top-10 md:-top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-0.5 md:px-3 md:py-1 rounded-full border border-red-500/30">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] md:text-xs font-mono text-red-500 font-bold">{formatDuration(duration)}</span>
        </div>
      )}

      {/* Processing Status */}
      {isUploading && (
        <div className="absolute -top-10 md:-top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-blue-600/80 backdrop-blur-md px-3 py-1 rounded-full text-white">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[10px] md:text-xs font-bold">Processing...</span>
        </div>
      )}

      <button
        onClick={toggleRecording}
        disabled={isUploading}
        className={cn(
          "h-10 w-10 md:h-12 md:w-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95",
          isRecording
            ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
            : "bg-slate-700 hover:bg-slate-600 text-slate-300",
          isUploading && "opacity-50 cursor-not-allowed"
        )}
        title={isRecording ? "Stop Recording" : "Start Recording"}
      >
        {isUploading ? (
          <Loader2 size={20} className="animate-spin md:w-6 md:h-6" />
        ) : isRecording ? (
          <Square size={18} className="fill-current md:w-5 md:h-5" />
        ) : (
          <Circle size={18} className="fill-current md:w-5 md:h-5" />
        )}
      </button>
    </div>
  );
}
