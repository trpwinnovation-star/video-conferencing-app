"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { buildRoomInviteLink } from "@/lib/roomAccess";
import { cn } from "@/lib/utils";

interface ShareRoomButtonProps {
  roomId: string;
  className?: string;
}

export function ShareRoomButton({ roomId, className }: ShareRoomButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const link = buildRoomInviteLink(roomId);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this invite link:", link);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      title="Copy invite link (password required to join)"
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all border cursor-pointer",
        copied
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-[#FBF9FA] border-stone-200/80 text-stone-700 hover:border-[#c16d18]/40 hover:text-[#c16d18]",
        className
      )}
    >
      {copied ? <Check size={16} /> : <Link2 size={16} />}
      <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}
