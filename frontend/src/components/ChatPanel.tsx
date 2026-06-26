"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Send, Paperclip, FileText, Download, Loader2, MapPin } from "lucide-react";
import { apiUploadSharedFile, API_ROOT } from "@/lib/api";
import { useParticipants, useLocalParticipant } from "@livekit/components-react";
import { ParticipantEvent } from "livekit-client";

export interface ChatMessage {
  id: string;
  sender: string;
  text?: string;
  file?: {
    name: string;
    size: number;
    url: string;
  };
  timestamp: number;
  isLocal: boolean;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSendFile: (fileInfo: { name: string; size: number; url: string }) => void;
  roomId: string;
  onTriggerGeoCapture?: (targetIdentity: string) => void;
}

export function ChatPanel({ isOpen, onClose, messages, onSendMessage, onSendFile, roomId, onTriggerGeoCapture }: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showGeoDropdown, setShowGeoDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const [participantMeta, setParticipantMeta] = useState<string | undefined>(
    localParticipant?.metadata
  );

  useEffect(() => {
    if (!localParticipant) return;
    setParticipantMeta(localParticipant.metadata);

    const handleMetadataChanged = () => {
      setParticipantMeta(localParticipant.metadata);
    };

    localParticipant.on(ParticipantEvent.ParticipantMetadataChanged, handleMetadataChanged);
    return () => {
      localParticipant.off(ParticipantEvent.ParticipantMetadataChanged, handleMetadataChanged);
    };
  }, [localParticipant]);

  const isHost = React.useMemo(() => {
    if (!participantMeta) return false;
    try {
      const meta = JSON.parse(participantMeta);
      return meta.isHost === true;
    } catch {
      return false;
    }
  }, [participantMeta]);

  const otherParticipants = React.useMemo(() => {
    if (!localParticipant) return [];
    return participants.filter(p => p.identity !== localParticipant.identity);
  }, [participants, localParticipant]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await apiUploadSharedFile(file, roomId);
      onSendFile({
        name: data.fileName,
        size: data.fileSize,
        url: data.fileUrl,
      });
      // Clear input
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      alert("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const getFullDownloadUrl = (relativeUrl: string) => {
    if (relativeUrl.startsWith("http")) return relativeUrl;
    return `${API_ROOT}${relativeUrl}`;
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[#FBF9FA] border-l border-stone-200 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#c16d18] shadow-[0_0_8px_rgba(193,109,24,0.6)]" />
          <h2 className="text-md font-bold text-stone-800 uppercase tracking-wider">In-call Messages</h2>
        </div>
        <button
          onClick={onClose}
          className="text-stone-500 hover:text-stone-800 p-1 rounded-lg hover:bg-stone-200/55 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Warning text */}
      <div className="px-6 py-2 bg-stone-100 text-[10px] text-stone-600 text-center border-b border-stone-200 select-none">
        Messages can only be seen by people in the call and are deleted when the call ends.
      </div>

      {/* Messages list */}
      <div className="flex-grow overflow-y-auto p-6 space-y-4 no-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-stone-600 px-4">
            <span className="text-4xl mb-3">💬</span>
            <p className="text-sm font-semibold text-stone-800">No messages yet</p>
            <p className="text-xs text-stone-500 mt-1 max-w-[200px] leading-relaxed">
              Send a text or attachment to start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] ${msg.isLocal ? "ml-auto items-end" : "mr-auto items-start"}`}
            >
              {/* Sender Name */}
              {!msg.isLocal && (
                <span className="text-[10px] font-bold text-stone-500 mb-1 px-1">{msg.sender}</span>
              )}

              {/* Message Bubble */}
              <div
                className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm max-w-full overflow-hidden ${msg.isLocal
                    ? "bg-[#c16d18] text-white rounded-tr-none"
                    : "bg-white border border-stone-200 text-stone-800 rounded-tl-none"
                  }`}
              >
                {msg.text && <p className="break-all">{msg.text}</p>}

                {msg.file && (
                  <div className="flex flex-col gap-2 min-w-[180px] sm:min-w-[200px] max-w-full">
                    <div className="flex items-start gap-2 min-w-0 max-w-full">
                      <FileText size={20} className={`shrink-0 mt-0.5 ${msg.isLocal ? "text-white opacity-85" : "text-[#c16d18]"}`} />
                      <div className="min-w-0 flex-grow">
                        <p className={`text-xs font-bold truncate leading-tight ${msg.isLocal ? "text-white" : "text-stone-800"}`} title={msg.file.name}>
                          {msg.file.name}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${msg.isLocal ? "opacity-75 text-white" : "text-stone-500"}`}>{formatBytes(msg.file.size)}</p>
                      </div>
                    </div>
                    <a
                      href={getFullDownloadUrl(msg.file.url)}
                      download={msg.file.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 cursor-pointer ${msg.isLocal
                          ? "bg-white/10 hover:bg-white/20 border-white/20 text-white"
                          : "bg-[#c16d18]/15 hover:bg-[#c16d18]/25 border-[#c16d18]/20 text-[#c16d18]"
                        }`}
                    >
                      <Download size={12} />
                      Download File
                    </a>
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-[9px] text-stone-400 mt-1 px-1 select-none">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input container */}
      <div className="p-4 border-t border-stone-200 bg-white/80 backdrop-blur-md">
        <form onSubmit={handleSendText} className="flex items-center gap-2">
          {/* File picker button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />
          {/* Geo Capture button (Host only) */}
          {isHost && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowGeoDropdown(!showGeoDropdown)}
                disabled={isUploading}
                className="h-10 w-10 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-[#c16d18] hover:text-[#a0560e] flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title="Geo-capture participant image"
              >
                <MapPin size={16} />
              </button>

              {showGeoDropdown && (
                <div className="absolute bottom-full mb-2 left-0 bg-white border border-stone-200/80 rounded-2xl p-1.5 shadow-2xl min-w-[180px] z-50 max-h-48 overflow-y-auto no-scrollbar">
                  <div className="text-[10px] font-bold text-stone-400 px-2.5 py-1 uppercase tracking-wider select-none border-b border-stone-100 mb-1">
                    Geo-Tag
                  </div>
                  {otherParticipants.length === 0 ? (
                    <div className="text-[10px] text-stone-500 px-2.5 py-2">
                      No other participants
                    </div>
                  ) : (
                    otherParticipants.map((p) => (
                      <button
                        key={p.identity}
                        type="button"
                        onClick={() => {
                          onTriggerGeoCapture?.(p.identity);
                          setShowGeoDropdown(false);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold transition-all text-stone-600 hover:bg-stone-50 hover:text-stone-900 cursor-pointer truncate"
                      >
                        {p.name || p.identity}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-10 w-10 shrink-0 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-stone-800 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Share a file"
          >
            {isUploading ? (
              <Loader2 className="animate-spin text-[#c16d18]" size={16} />
            ) : (
              <Paperclip size={16} />
            )}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isUploading}
            placeholder="Send a message..."
            className="flex-grow h-10 px-4 bg-white border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#c16d18] focus:border-[#c16d18] text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isUploading}
            className="h-10 w-10 shrink-0 rounded-xl bg-[#c16d18] hover:bg-[#a0560e] text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
