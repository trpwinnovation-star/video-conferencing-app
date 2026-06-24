"use client";

import React from "react";
import { useMediaDeviceSelect } from "@livekit/components-react";
import { X, Mic, Volume2, Video } from "lucide-react";

interface DeviceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeviceSettingsModal({ isOpen, onClose }: DeviceSettingsModalProps) {
  const { 
    devices: micDevices, 
    activeDeviceId: activeMicId, 
    setActiveMediaDevice: setActiveMic 
  } = useMediaDeviceSelect({ kind: "audioinput" });

  const { 
    devices: speakerDevices, 
    activeDeviceId: activeSpeakerId, 
    setActiveMediaDevice: setActiveSpeaker 
  } = useMediaDeviceSelect({ kind: "audiooutput" });

  const { 
    devices: cameraDevices, 
    activeDeviceId: activeCameraId, 
    setActiveMediaDevice: setActiveCamera 
  } = useMediaDeviceSelect({ kind: "videoinput" });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200/80 w-full max-w-md animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="text-xl font-bold text-stone-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Microphone */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <Mic size={16} className="text-[#c16d18]" />
              Microphone
            </label>
            <select
              value={activeMicId || ""}
              onChange={(e) => setActiveMic(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/20 focus:border-[#c16d18] transition-all cursor-pointer"
            >
              {micDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.substring(0, 5)}...`}
                </option>
              ))}
            </select>
          </div>

          {/* Speaker */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <Volume2 size={16} className="text-[#c16d18]" />
              Speaker
            </label>
            <select
              value={activeSpeakerId || ""}
              onChange={(e) => setActiveSpeaker(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/20 focus:border-[#c16d18] transition-all cursor-pointer"
            >
              {speakerDevices.length === 0 ? (
                <option value="">System Default Audio</option>
              ) : (
                speakerDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Speaker ${device.deviceId.substring(0, 5)}...`}
                  </option>
                ))
              )}
            </select>
            {speakerDevices.length === 0 && (
              <p className="text-xs text-stone-500 mt-1">
                Your browser might not support manual speaker selection.
              </p>
            )}
          </div>

          {/* Camera */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <Video size={16} className="text-[#c16d18]" />
              Camera
            </label>
            <select
              value={activeCameraId || ""}
              onChange={(e) => setActiveCamera(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/20 focus:border-[#c16d18] transition-all cursor-pointer"
            >
              {cameraDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.substring(0, 5)}...`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-stone-100 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#c16d18] hover:bg-[#a0560e] text-white text-sm font-bold rounded-xl transition-colors shadow-md active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
