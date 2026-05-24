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
      <div className="flex min-h-screen bg-[#FBF9FA] items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#c16d18] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FBF9FA] flex-col text-stone-900">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#c16d18] rounded-xl shadow-md shadow-[#c16d18]/25">
            <Video size={18} className="text-white" />
          </div>
          <span className="text-stone-900 font-bold text-xl tracking-tight">MeetSpace</span>
        </div>
        
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-stone-700 text-sm">
                <div className="w-8.5 h-8.5 rounded-full bg-[#c16d18]/10 border border-[#c16d18]/20 flex items-center justify-center text-[#c16d18] font-bold text-sm">
                  {user.name[0].toUpperCase()}
                </div>
                <span className="hidden sm:block font-medium">{user.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-stone-500 hover:text-stone-800 text-sm font-medium transition-colors"
              >
                <LogOut size={16} />
                <span className="hidden sm:block">Sign out</span>
              </button>
            </div>
          ) : (
            <>
              <Link href="/login" className="text-stone-600 hover:text-stone-900 font-semibold text-sm transition-colors">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="bg-[#c16d18] hover:bg-[#a0560e] text-white text-sm px-4.5 py-2.5 rounded-xl font-bold shadow-md shadow-[#c16d18]/15 transition-all active:scale-95"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center px-6 md:px-24 gap-12 py-16 max-w-7xl mx-auto w-full">
        <div className="flex-1 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-[#c16d18]/10 border border-[#c16d18]/20 rounded-full px-4 py-1.5 mb-6 shadow-sm">
            <div className="w-2 h-2 bg-[#c16d18] rounded-full animate-pulse" />
            <span className="text-[#c16d18] text-xs font-bold uppercase tracking-wider">Powered by LiveKit</span>
          </div>
          
          <h1 className="text-4xl md:text-5.5xl font-extrabold mb-6 tracking-tight text-stone-900 leading-tight">
            Premium video meetings.{" "}
            <span className="text-[#c16d18] block mt-1">Now free for everyone.</span>
          </h1>
          
          <p className="text-lg text-stone-600 mb-10 max-w-xl leading-relaxed">
            Secure, real-time video conferencing with screen sharing, recording, and more.
          </p>

          {/* Guest name input if not logged in */}
          {!user && (
            <div className="mb-8">
              <label className="block text-sm font-semibold text-stone-600 mb-2.5 flex items-center gap-1.5">
                <UserIcon size={14} className="text-[#c16d18]" />
                Join as guest
              </label>
              <input
                type="text"
                placeholder="Enter your name..."
                value={guestName}
                onChange={(e) => { setGuestName(e.target.value); setError(""); }}
                className="px-4 py-3 bg-white border border-stone-200 focus:border-[#c16d18] focus:ring-2 focus:ring-[#c16d18]/15 rounded-xl focus:outline-none w-full sm:w-80 text-stone-900 placeholder-stone-400 shadow-sm transition-all"
              />
            </div>
          )}

          {error && <p className="text-red-600 mb-4 text-sm font-semibold">{error}</p>}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 border-t border-stone-200/80 pt-6">
            <button
              onClick={handleCreateRoom}
              className="flex items-center justify-center gap-2 bg-[#c16d18] hover:bg-[#a0560e] text-white px-6 py-3.5 rounded-xl font-bold transition-all w-full sm:w-auto shadow-lg shadow-[#c16d18]/20 active:scale-95"
            >
              <Video size={20} />
              New meeting
            </button>

            <form onSubmit={handleJoinRoom} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Keyboard size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Enter a code or link"
                  value={roomCode}
                  onChange={(e) => { setRoomCode(e.target.value); setError(""); }}
                  className="pl-11 pr-4 py-3.5 bg-white border border-stone-200 focus:border-[#c16d18] focus:ring-2 focus:ring-[#c16d18]/15 rounded-xl focus:outline-none w-full sm:w-64 text-stone-900 placeholder-stone-400 shadow-sm transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={!roomCode.trim()}
                className={cn(
                  "px-5 py-3.5 rounded-xl font-bold transition-all border-2 w-full sm:w-auto text-center active:scale-95 cursor-pointer",
                  roomCode.trim() 
                    ? "border-[#c16d18] text-[#c16d18] hover:bg-[#c16d18]/5" 
                    : "border-stone-200 text-stone-400 cursor-not-allowed"
                )}
              >
                Join
              </button>
            </form>
          </div>
        </div>

        {/* Visual Graphic */}
        <div className="flex-1 hidden md:flex justify-center items-center">
          <div className="relative w-full max-w-sm aspect-square flex items-center justify-center">
            {/* Elegant Glow Rings */}
            <div className="absolute inset-0 rounded-full border border-[#c16d18]/10 flex items-center justify-center bg-white/40 shadow-inner">
              <div className="w-4/5 h-4/5 rounded-full bg-gradient-to-tr from-[#c16d18]/10 to-stone-100 flex items-center justify-center border border-stone-200/50 shadow-md">
                <Video size={64} className="text-[#c16d18]/30" />
              </div>
            </div>
            {/* Top Right Floating Badge */}
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white border border-stone-200/80 rounded-2xl flex items-center justify-center shadow-xl animate-bounce duration-1000">
              <div className="w-10 h-10 bg-[#c16d18]/10 rounded-xl flex items-center justify-center">
                <Video size={20} className="text-[#c16d18]" />
              </div>
            </div>
            {/* Bottom Left Floating Badge */}
            <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white border border-stone-200/80 rounded-2xl flex items-center justify-center shadow-xl">
              <div className="w-10 h-10 bg-green-600/10 rounded-xl flex items-center justify-center">
                <div className="w-3.5 h-3.5 bg-green-600 rounded-full animate-ping" />
                <div className="w-2.5 h-2.5 bg-green-600 rounded-full absolute" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
