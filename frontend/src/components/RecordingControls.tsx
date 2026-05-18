"use client";

import { useState, useEffect } from "react";
import { Circle, Square, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { startEgressRecording, stopEgressRecording } from "@/lib/api";
import { useRecording } from "@/hooks/useRecording";
import { useLocalParticipant, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { ChevronDown, Monitor, Cloud, Mic, MicOff } from "lucide-react";

interface RecordingControlsProps {
  roomName: string;
}

export function RecordingControls({ roomName }: RecordingControlsProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [showModeMenu, setShowModeMenu] = useState(false);
  
  // Changed default to 'local'
  const [recordingMode, setRecordingMode] = useState<"local" | "cloud">("local");
  // New state to toggle audio recording
  const [recordAudio, setRecordAudio] = useState(true);
  
  // Get all active audio tracks in the room (microphones and screen share audio)
  const audioTracks = useTracks([Track.Source.Microphone, Track.Source.ScreenShareAudio]);

  // --- Local (Browser) Recording Logic ---
  const localRecorder = useRecording({
    roomName,
    onSuccess: (path) => {
      setToastMessage("Local recording saved successfully!");
      setToastType("success");
      setShowToast(true);
    },
    onError: (err) => {
      setToastMessage(err);
      setToastType("error");
      setShowToast(true);
    }
  });

  // --- Cloud (Server/Egress) Recording Logic ---
  const [isCloudRecording, setIsCloudRecording] = useState(false);
  const [isCloudProcessing, setIsCloudProcessing] = useState(false);
  const [cloudDuration, setCloudDuration] = useState(0);
  const [egressId, setEgressId] = useState<string | null>(null);

  // Cloud Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCloudRecording) {
      interval = setInterval(() => {
        setCloudDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCloudDuration(0);
    }
    return () => clearInterval(interval);
  }, [isCloudRecording]);

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
    }
  };

  const toggleCloudRecording = async () => {
    try {
      setIsCloudProcessing(true);
      if (isCloudRecording && egressId) {
        await stopEgressRecording(egressId);
        setIsCloudRecording(false);
        setEgressId(null);
        setToastMessage("Cloud recording stopped. Processing on server...");
        setToastType("success");
        setShowToast(true);
      } else {
        const res = await startEgressRecording(roomName);
        if (res.egressId) {
          setEgressId(res.egressId);
          setIsCloudRecording(true);
          setToastMessage("Server-side cloud recording started!");
          setToastType("success");
          setShowToast(true);
        }
      }
    } catch (error: any) {
      console.error("Cloud recording error:", error);
      setToastMessage(error.message || "Cloud recording failed");
      setToastType("error");
      setShowToast(true);
    } finally {
      setIsCloudProcessing(false);
    }
  };

  const isAnyRecording = localRecorder.isRecording || isCloudRecording;
  const isAnyProcessing = localRecorder.isUploading || isCloudProcessing;
  const currentDuration = localRecorder.isRecording ? localRecorder.duration : cloudDuration;

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
      {isAnyRecording && (
        <div className="absolute -top-10 md:-top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-0.5 md:px-3 md:py-1 rounded-full border border-red-500/30">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] md:text-xs font-mono text-red-500 font-bold">
            {recordingMode === 'cloud' ? 'CLOUD' : 'LOCAL'} {formatDuration(currentDuration)}
          </span>
        </div>
      )}

      {/* Processing Status */}
      {isAnyProcessing && (
        <div className="absolute -top-10 md:-top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-blue-600/80 backdrop-blur-md px-3 py-1 rounded-full text-white">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[10px] md:text-xs font-bold">Processing...</span>
        </div>
      )}

      <div className="flex items-center">
        <button
          onClick={() => {
            if (recordingMode === 'local') {
              toggleLocalRecording();
            } else {
              toggleCloudRecording();
            }
          }}
          disabled={isAnyProcessing}
          className={cn(
            "h-10 w-10 md:h-12 md:w-12 rounded-l-2xl flex items-center justify-center transition-all shadow-lg active:scale-95",
            isAnyRecording
              ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
              : "bg-slate-700 hover:bg-slate-600 text-slate-300",
            isAnyProcessing && "opacity-50 cursor-not-allowed"
          )}
          title={isAnyRecording ? "Stop Recording" : `Start ${recordingMode === 'cloud' ? 'Cloud' : 'Local'} Recording`}
        >
          {isAnyProcessing ? (
            <Loader2 size={20} className="animate-spin md:w-6 md:h-6" />
          ) : isAnyRecording ? (
            <Square size={18} className="fill-current md:w-5 md:h-5" />
          ) : (
            <Circle size={18} className="fill-current md:w-5 md:h-5" />
          )}
        </button>

        {/* Mode Selector Toggle */}
        <div className="relative">
          <button
            onClick={() => !isAnyRecording && setShowModeMenu(!showModeMenu)}
            disabled={isAnyRecording || isAnyProcessing}
            className={cn(
              "h-10 w-6 md:h-12 md:w-8 rounded-r-2xl flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 border-l border-white/5 transition-all",
              isAnyRecording && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronDown size={14} className={cn("transition-transform", showModeMenu && "rotate-180")} />
          </button>

          {showModeMenu && (
            <div className="absolute bottom-full mb-2 right-0 bg-slate-900 border border-white/10 rounded-xl p-1 shadow-2xl min-w-[160px] animate-in fade-in slide-in-from-bottom-2 duration-200 z-[100]">
              <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Recording Mode
              </div>
              <button
                onClick={() => {
                  setRecordingMode("local");
                  setShowModeMenu(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-colors mb-1",
                  recordingMode === "local" ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-white/5"
                )}
              >
                <Monitor size={16} />
                <span>Local (Browser)</span>
              </button>
              <button
                onClick={() => {
                  setRecordingMode("cloud");
                  setShowModeMenu(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-colors",
                  recordingMode === "cloud" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/5"
                )}
              >
                <Cloud size={16} />
                <span>Cloud (Server)</span>
              </button>
              
              <div className="h-px bg-white/10 my-2" />
              
              <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Options
              </div>
              <button
                onClick={() => setRecordAudio(!recordAudio)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-colors text-slate-300 hover:bg-white/5"
                title="Toggle audio recording"
              >
                {recordAudio ? <Mic size={16} className="text-green-500" /> : <MicOff size={16} className="text-red-500" />}
                <span>{recordAudio ? "Audio Included" : "No Audio"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
