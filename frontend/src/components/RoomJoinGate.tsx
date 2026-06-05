"use client";

import { useState } from "react";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { getToken } from "@/lib/api";
import { saveRoomPassword } from "@/lib/roomAccess";
import Link from "next/link";

interface RoomJoinGateProps {
  roomId: string;
  participantName: string;
  onNameChange: (name: string) => void;
  onVerified: (password: string, token: string) => void;
  initialPassword?: string;
}

export function RoomJoinGate({
  roomId,
  participantName,
  onNameChange,
  onVerified,
  initialPassword = "",
}: RoomJoinGateProps) {
  const [password, setPassword] = useState(initialPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!participantName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter the room password.");
      return;
    }

    setLoading(true);
    try {
      // Fetch the token directly — this verifies the password AND returns the token
      // in a single round trip. The token is passed up to the parent to avoid a second call.
      const token = await getToken(roomId, participantName.trim(), password);
      saveRoomPassword(roomId, password);
      onVerified(password, token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not join room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#FBF9FA] text-stone-900 p-6">
      <div className="w-full max-w-md bg-white border border-stone-200/80 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-[#c16d18]/10 rounded-xl">
            <Lock size={22} className="text-[#c16d18]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900">Join meeting</h1>
            <p className="text-sm text-stone-500">
              Room: <span className="font-mono font-semibold text-[#c16d18]">{roomId}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-stone-600 mb-2">Your name</label>
            <input
              type="text"
              required
              value={participantName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c16d18]/15 focus:border-[#c16d18]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-600 mb-2">Room password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter meeting password"
                className="w-full px-4 py-3 pr-12 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c16d18]/15 focus:border-[#c16d18]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#c16d18]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-stone-500 mt-1.5">
              Ask the host for the password. Invite links do not include it.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-600 text-sm font-semibold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#c16d18] hover:bg-[#a0560e] disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? "Verifying..." : "Join meeting"}
          </button>
        </form>

        <p className="text-center text-stone-500 text-sm mt-6">
          <Link href="/" className="text-[#c16d18] hover:underline font-semibold">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
