"use client";

import { useState } from "react";
import { Circle, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { startEgressRecording, stopEgressRecording } from "@/lib/api";

interface RecordingButtonProps {
  roomName: string;
}

export function RecordingButton({ roomName }: RecordingButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);

  const toggleRecording = async () => {
    try {
      setIsLoading(true);
      if (isRecording && egressId) {
        await stopEgressRecording(egressId);
        setIsRecording(false);
        setEgressId(null);
      } else {
        const res = await startEgressRecording(roomName);
        if (res.egressId) {
          setEgressId(res.egressId);
          setIsRecording(true);
        }
      }
    } catch (error) {
      console.error("Failed to toggle recording", error);
      alert("Recording failed. Check backend console for Egress configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={toggleRecording}
      disabled={isLoading}
      className={cn(
        "p-4 rounded-full flex items-center justify-center transition-all",
        isRecording 
          ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/50" 
          : "bg-slate-800 hover:bg-slate-700 text-slate-300",
        isLoading && "opacity-50 cursor-not-allowed"
      )}
      title={isRecording ? "Stop Recording" : "Start Recording"}
    >
      {isLoading ? (
        <Loader2 size={24} className="animate-spin" />
      ) : isRecording ? (
        <Square size={24} className="fill-current" />
      ) : (
        <Circle size={24} className="fill-current" />
      )}
    </button>
  );
}
