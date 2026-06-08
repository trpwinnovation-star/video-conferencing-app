"use client";

import { useState } from "react";
import { X, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { createProtectedRoom } from "@/lib/api";
import { saveRoomPassword } from "@/lib/roomAccess";
import { useAuth } from "@/lib/auth";

interface CreateRoomModalProps {
  roomId: string;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

export function CreateRoomModal({ roomId, onClose, onCreated }: CreateRoomModalProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState(user?.meetingDefaultPassword || "");
  const [confirmPassword, setConfirmPassword] = useState(user?.meetingDefaultPassword || "");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await createProtectedRoom(roomId, password);
      saveRoomPassword(roomId, password);
      onCreated(roomId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200/80 p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-[#c16d18]/10 rounded-xl">
            <Lock size={20} className="text-[#c16d18]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">Secure your meeting</h2>
            <p className="text-sm text-stone-500">
              Room code: <span className="font-mono font-semibold text-[#c16d18]">{roomId}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-stone-600 mb-2">Meeting password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 4 characters"
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
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-600 mb-2">Confirm password</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c16d18]/15 focus:border-[#c16d18]"
            />
          </div>

          <p className="text-xs text-stone-500">
            Share the invite link from the meeting room. Guests will need this password to join.
          </p>

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
            {loading ? "Creating..." : "Start meeting"}
          </button>
        </form>
      </div>
    </div>
  );
}
