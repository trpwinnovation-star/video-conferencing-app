"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Video, Keyboard, LogOut, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");

  const getDisplayName = () => user?.name || guestName;

  const handleCreateRoom = () => {
    const name = getDisplayName();
    if (!name.trim()) {
      setError("Please enter your name to continue as guest, or sign in.");
      return;
    }
    const randomCode = Math.random().toString(36).substring(2, 11);
    router.push(`/room/${randomCode}?name=${encodeURIComponent(name)}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = getDisplayName();
    if (!name.trim()) {
      setError("Please enter your name to continue as guest, or sign in.");
      return;
    }
    if (!roomCode.trim()) {
      setError("Please enter a room code.");
      return;
    }
    router.push(`/room/${roomCode.trim()}?name=${encodeURIComponent(name)}`);
  };

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-950 items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-900">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Video size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">MeetSpace</span>
        </div>
        
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-slate-300 text-sm">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-semibold text-sm">
                  {user.name[0].toUpperCase()}
                </div>
                <span className="hidden sm:block">{user.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 text-sm transition-colors"
              >
                <LogOut size={16} />
                <span className="hidden sm:block">Sign out</span>
              </button>
            </div>
          ) : (
            <>
              <Link href="/login" className="text-slate-300 hover:text-white text-sm transition-colors">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-all"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center px-6 md:px-24 gap-12 py-16">
        <div className="flex-1 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-blue-400 text-sm font-medium">Powered by LiveKit</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-semibold mb-6 tracking-tight text-white leading-tight">
            Premium video meetings.{" "}
            <span className="text-slate-400">Now free for everyone.</span>
          </h1>
          
          <p className="text-lg text-slate-400 mb-10 max-w-xl">
            Secure, real-time video conferencing with screen sharing, recording, and more.
          </p>

          {/* Guest name input if not logged in */}
          {!user && (
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2 flex items-center gap-1.5">
                <UserIcon size={14} />
                Join as guest
              </label>
              <input
                type="text"
                placeholder="Enter your name..."
                value={guestName}
                onChange={(e) => { setGuestName(e.target.value); setError(""); }}
                className="px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-72 text-white placeholder-slate-500 transition-all"
              />
            </div>
          )}

          {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-t border-slate-800 pt-6">
            <button
              onClick={handleCreateRoom}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all w-full sm:w-auto shadow-lg shadow-blue-500/20"
            >
              <Video size={20} />
              New meeting
            </button>

            <form onSubmit={handleJoinRoom} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Keyboard size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Enter a code or link"
                  value={roomCode}
                  onChange={(e) => { setRoomCode(e.target.value); setError(""); }}
                  className="pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 text-white placeholder-slate-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={!roomCode.trim()}
                className={cn(
                  "px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap",
                  roomCode.trim() ? "text-blue-500 hover:bg-slate-900" : "text-slate-600 cursor-not-allowed"
                )}
              >
                Join
              </button>
            </form>
          </div>
        </div>

        {/* Visual */}
        <div className="flex-1 hidden md:flex justify-center items-center">
          <div className="relative w-full max-w-sm aspect-square">
            <div className="absolute inset-0 rounded-full border border-slate-800 flex items-center justify-center bg-slate-900/30">
              <div className="w-3/4 h-3/4 rounded-full bg-gradient-to-tr from-blue-900/30 to-slate-800/60 flex items-center justify-center">
                <Video size={64} className="text-blue-500/40" />
              </div>
            </div>
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center shadow-xl">
              <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
                <Video size={20} className="text-blue-500" />
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center shadow-xl">
              <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
