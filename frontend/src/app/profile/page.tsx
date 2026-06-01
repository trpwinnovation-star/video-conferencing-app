"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { User as UserIcon, Lock, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiChangePassword } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9FA] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#c16d18]" size={32} />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiChangePassword(currentPassword, newPassword);
      setSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to change password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9FA] text-stone-900 pb-12">
      {/* Navbar */}
      <nav className="flex items-center justify-between h-16 px-8 bg-white/80 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-50">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Image src="/logo_betel.png" alt="BetelMeet Logo" width={160} height={40} className="object-contain mix-blend-multiply" />
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 text-sm font-semibold transition-colors">
          <ArrowLeft size={16} />
          Back to Home
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto mt-12 px-6">
        <h1 className="text-3xl font-extrabold mb-8 tracking-tight text-stone-900">Your Profile</h1>

        <div className="grid md:grid-cols-3 gap-8">
          {/* User Details Card */}
          <div className="md:col-span-1">
            <div className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-xl text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#c16d18] to-[#965310] mx-auto flex items-center justify-center text-white text-3xl font-extrabold shadow-lg shadow-[#c16d18]/20 mb-4 border-4 border-white">
                {user.name[0].toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-stone-900">{user.name}</h2>
              <p className="text-stone-500 text-sm mt-1 flex items-center justify-center gap-1.5">
                <UserIcon size={14} />
                {user.email}
              </p>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="md:col-span-2">
            <div className="bg-white border border-stone-200/80 rounded-2xl p-8 shadow-xl">
              <h2 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
                <Lock size={18} className="text-[#c16d18]" />
                Change Password
              </h2>

              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-stone-600 mb-2">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/15 focus:border-[#c16d18] transition-all"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-stone-600 mb-2">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/15 focus:border-[#c16d18] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-stone-600 mb-2">Confirm New</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/15 focus:border-[#c16d18] transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-600 text-sm font-semibold flex items-center gap-2">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-green-700 text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full py-3.5 bg-[#c16d18] hover:bg-[#a0560e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#c16d18]/25 active:scale-95 cursor-pointer mt-2"
                >
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  {isSubmitting ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
