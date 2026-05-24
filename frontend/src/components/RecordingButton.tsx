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
        "p-4 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border",
        isRecording 
          ? "bg-[#c16d18]/10 text-[#c16d18] hover:bg-[#c16d18]/15 border-[#c16d18]/30 animate-pulse" 
          : "bg-white hover:bg-stone-50 text-[#c16d18] border-stone-200",
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
