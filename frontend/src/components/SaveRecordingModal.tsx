"use client";

import React, { useState } from "react";
import { Download, Mail, X, CheckCircle2, HardDrive } from "lucide-react";

interface SaveRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  blob: Blob;
  roomName: string;
  duration: number;
}

export function SaveRecordingModal({ isOpen, onClose, blob, roomName, duration }: SaveRecordingModalProps) {
  const [fileName, setFileName] = useState(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `Recording-${roomName}-${timestamp}`;
  });
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cleanName = fileName.trim().endsWith(".webm")
      ? fileName.trim()
      : `${fileName.trim()}.webm`;
    a.download = cleanName || `Recording-${roomName}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200/80 w-full max-w-md animate-in zoom-in-95 duration-300 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#c16d18] to-[#e8943a] px-6 py-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <HardDrive size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Recording Ready</h2>
              <p className="text-white/80 text-sm">Your meeting recording is available</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Recording Info */}
          <div className="bg-stone-50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-stone-900 text-sm">{roomName}</p>
              <p className="text-xs text-stone-500 mt-0.5">
                Duration: {formatDuration(duration)} • Size: {formatFileSize(blob.size)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#c16d18]/10 flex items-center justify-center">
              <span className="text-[#c16d18] text-xs font-bold">.webm</span>
            </div>
          </div>

          {/* File Name Input */}
          <div className="space-y-1.5">
            <label htmlFor="fileNameInput" className="text-xs font-bold text-stone-600 uppercase tracking-wider block">
              File Name
            </label>
            <div className="flex rounded-xl border border-stone-200 bg-stone-50 overflow-hidden focus-within:border-[#c16d18] transition-colors">
              <input
                id="fileNameInput"
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="flex-1 px-4 py-2 bg-transparent text-sm text-stone-900 focus:outline-none font-medium"
                placeholder="Enter file name..."
              />
              <span className="bg-stone-200/50 px-3 flex items-center text-xs font-bold text-stone-500 border-l border-stone-200">
                .webm
              </span>
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-3 bg-[#c16d18] hover:bg-[#a0560e] text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-[#c16d18]/25 active:scale-[0.98] cursor-pointer"
          >
            {downloaded ? (
              <>
                <CheckCircle2 size={20} />
                Downloaded! Click to Save Again
              </>
            ) : (
              <>
                <Download size={20} />
                Save to Device
              </>
            )}
          </button>

          {/* Email Info */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <Mail size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Email copy processing</p>
              <p className="text-xs text-blue-600 mt-0.5">
                A copy is being uploaded to the cloud. You'll receive an email with the recording link once it's ready.
              </p>
            </div>
          </div>

          {/* Server download limit info */}
          <p className="text-stone-400 text-sm mb-6 text-center">
            A raw backup of your recording is ready. <br />
            <span className="text-[#c16d18] font-bold">Note: A highly compatible MP4 is being processed on the server and will be available in your Dashboard.</span>
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-sm hover:bg-stone-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
