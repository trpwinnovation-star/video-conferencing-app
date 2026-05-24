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
  userEmail?: string;
  userName?: string;
}

export function RecordingControls({ roomName, userEmail, userName }: RecordingControlsProps) {
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
          "absolute -top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-300 border",
          toastType === "success"
            ? "bg-green-50 text-green-800 border-green-200"
            : "bg-red-50 text-red-800 border-red-200"
        )}>
          {toastType === "success" ? <CheckCircle2 size={16} className="text-green-600" /> : <AlertCircle size={16} className="text-red-600" />}
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Recording Timer Badge */}
      {isAnyRecording && (
        <div className="absolute -top-10 md:-top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white border border-stone-200 shadow-md px-2 py-0.5 md:px-3 md:py-1 rounded-full">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#c16d18] animate-pulse" />
          <span className="text-[10px] md:text-xs font-mono text-[#c16d18] font-extrabold">
            {recordingMode === 'cloud' ? 'CLOUD' : 'LOCAL'} {formatDuration(currentDuration)}
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
          onClick={() => {
            if (recordingMode === 'local') {
              toggleLocalRecording();
            } else {
              toggleCloudRecording();
            }
          }}
          disabled={isAnyProcessing}
          className={cn(
            "h-10 w-10 md:h-12 md:w-12 rounded-l-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border",
            isAnyRecording
              ? "bg-[#c16d18] hover:bg-[#a0560e] text-white border-[#c16d18] animate-pulse"
              : "bg-white hover:bg-stone-50 text-[#c16d18] border-stone-200",
            isAnyProcessing && "opacity-50 cursor-not-allowed"
          )}
          title={isAnyRecording ? "Stop Recording" : `Start ${recordingMode === 'cloud' ? 'Cloud' : 'Local'} Recording`}
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
              <div className="px-3 py-2 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                Recording Mode
              </div>

              {/* Local Mode Option */}
              <button
                onClick={() => {
                  setRecordingMode("local");
                  setShowModeMenu(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all mb-1 cursor-pointer",
                  recordingMode === "local"
                    ? "bg-[#c16d18]/10 text-[#c16d18] border border-[#c16d18]/20"
                    : "text-stone-600 hover:bg-stone-50"
                )}
              >
                <Monitor size={15} className={recordingMode === "local" ? "text-[#c16d18]" : "text-stone-400"} />
                <span>Local (Browser)</span>
                {recordingMode === "local" && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#c16d18]" />
                )}
              </button>

              {/* Cloud Mode Option */}
              <button
                onClick={() => {
                  setRecordingMode("cloud");
                  setShowModeMenu(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  recordingMode === "cloud"
                    ? "bg-stone-100 text-stone-800 border border-stone-200"
                    : "text-stone-600 hover:bg-stone-50"
                )}
              >
                <Cloud size={15} className={recordingMode === "cloud" ? "text-stone-600" : "text-stone-400"} />
                <span>Cloud (Server)</span>
                {recordingMode === "cloud" && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-stone-500" />
                )}
              </button>

              {/* Divider */}
              <div className="h-px bg-stone-100 my-2 mx-2" />

              {/* Audio Options */}
              <div className="px-3 py-1 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                Options
              </div>
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
