"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { User as UserIcon, Lock, Loader2, ArrowLeft, CheckCircle2, Key } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiChangePassword, apiUpdateDefaultPassword } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [defaultPassword, setDefaultPassword] = useState(user?.meetingDefaultPassword || "");
  const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);
  const [defaultError, setDefaultError] = useState("");
  const [defaultSuccess, setDefaultSuccess] = useState("");

  useEffect(() => {
    if (user?.meetingDefaultPassword) {
      setDefaultPassword(user.meetingDefaultPassword);
    }
  }, [user]);

  const handleUpdateDefaultPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setDefaultError("");
    setDefaultSuccess("");

    if (!defaultPassword) {
      setDefaultError("Password cannot be empty.");
      return;
    }

    setIsUpdatingDefault(true);
    try {
      await apiUpdateDefaultPassword(defaultPassword);
      setDefaultSuccess("Default meeting password updated successfully!");
      await refresh();
    } catch (err: any) {
      setDefaultError(err.message || "Failed to update default meeting password");
    } finally {
      setIsUpdatingDefault(false);
    }
  };

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
        <div className="flex flex-col items-end w-max py-1">
          <Link href="/" className="block hover:opacity-80 transition-opacity">
            <img
              src="/betel_meet_new.png"
              alt="BetelMeet Logo"
              className="w-[120px] sm:w-[135px] h-auto object-contain mix-blend-multiply block"
            />
          </Link>
          <a
            href="https://trpwpartners.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="block font-serif font-semibold text-[#c16d18] mt-0 sm:-mt-[2px] mr-[2px] tracking-[0.2px] leading-none text-[11px] sm:text-[9.5px] hover:opacity-80 hover:underline decoration-[#c16d18] transition-all"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            by TRPW Partners
          </a>
        </div>
        <Link href="/" className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 text-sm font-semibold transition-colors">
          <ArrowLeft size={16} />
          Back to Home
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto mt-12 px-6">
        <h1 className="text-3xl font-extrabold mb-8 tracking-tight text-stone-900">Your Profile</h1>

        <div className="grid md:grid-cols-12 gap-8">
          {/* User Details Card */}
          <div className="md:col-span-4 lg:col-span-4">
            <div className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col relative group">
              {/* Cover Header */}
              <div className="h-28 w-full bg-gradient-to-br from-[#c16d18]/10 via-[#e8943a]/5 to-[#c16d18]/20 border-b border-stone-100"></div>

              <div className="px-6 pb-8 pt-0 text-center relative flex-grow flex flex-col items-center">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full bg-white mx-auto flex items-center justify-center text-[#c16d18] text-4xl font-extrabold shadow-md mb-4 -mt-12 border-4 border-white relative z-10 group-hover:scale-105 transition-transform duration-300">
                  {user.name[0].toUpperCase()}
                </div>

                {/* Name */}
                <h2
                  className="text-xl font-bold text-stone-900 w-full truncate px-2"
                  title={user.name}
                >
                  {user.name}
                </h2>

                {/* Email */}
                <div className="w-full mt-3">
                  <div className="flex flex-col items-center justify-center gap-1.5 bg-stone-50 border border-stone-100 rounded-xl p-3 w-full">
                    <div className="flex items-center gap-1.5 text-stone-400">
                      <UserIcon size={14} />
                      <span className="text-xs font-semibold uppercase tracking-wider">Email</span>
                    </div>
                    <span className="text-stone-700 text-sm font-medium break-all text-center leading-tight">
                      {user.email}
                    </span>
                  </div>
                </div>

                {/* Role / Status Badge (Optional aesthetic addition) */}
                <div className="mt-6">
                  <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-bold uppercase tracking-wider">
                    Active Account
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column containing both cards */}
          <div className="md:col-span-8 lg:col-span-8 space-y-8">
            {/* Change Password Card */}
            <div className="bg-white border border-stone-200/80 rounded-2xl p-8 sm:p-10 shadow-sm">
              <div className="mb-8 border-b border-stone-100 pb-5">
                <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2.5">
                  <Lock size={20} className="text-[#c16d18]" />
                  Password & Security
                </h2>
                <p className="text-sm text-stone-500 mt-2">
                  Update your password regularly to keep your account secure.
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-6 w-full">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/20 focus:border-[#c16d18] transition-all shadow-sm"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-6 pt-2">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/20 focus:border-[#c16d18] transition-all shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/20 focus:border-[#c16d18] transition-all shadow-sm"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border-l-4 border-red-500 px-4 py-3 text-red-700 text-sm font-medium flex items-center gap-2 rounded-r-md">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border-l-4 border-green-500 px-4 py-3 text-green-700 text-sm font-medium flex items-center gap-2 rounded-r-md">
                    <CheckCircle2 size={18} />
                    {success}
                  </div>
                )}

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
                    className="py-2.5 px-6 bg-[#c16d18] hover:bg-[#a0560e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
                  >
                    {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                    {isSubmitting ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>

            {/* Default Meeting Password Card */}
            <div className="bg-white border border-stone-200/80 rounded-2xl p-8 sm:p-10 shadow-sm">
              <div className="mb-8 border-b border-stone-100 pb-5">
                <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2.5">
                  <Key size={20} className="text-[#c16d18]" />
                  Default Meeting Password
                </h2>
                <p className="text-sm text-stone-500 mt-2">
                  Set a default password that will automatically secure new meetings you create.
                </p>
              </div>

              <form onSubmit={handleUpdateDefaultPassword} className="space-y-6 w-full">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Default Password</label>
                  <input
                    type="text"
                    required
                    value={defaultPassword}
                    onChange={(e) => setDefaultPassword(e.target.value)}
                    placeholder="Enter default password (e.g. 1234)"
                    className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/20 focus:border-[#c16d18] transition-all shadow-sm"
                  />
                </div>

                {defaultError && (
                  <div className="bg-red-50 border-l-4 border-red-500 px-4 py-3 text-red-700 text-sm font-medium flex items-center gap-2 rounded-r-md">
                    {defaultError}
                  </div>
                )}

                {defaultSuccess && (
                  <div className="bg-green-50 border-l-4 border-green-500 px-4 py-3 text-green-700 text-sm font-medium flex items-center gap-2 rounded-r-md">
                    <CheckCircle2 size={18} />
                    {defaultSuccess}
                  </div>
                )}

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isUpdatingDefault || !defaultPassword || defaultPassword === user.meetingDefaultPassword}
                    className="py-2.5 px-6 bg-[#c16d18] hover:bg-[#a0560e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
                  >
                    {isUpdatingDefault && <Loader2 size={18} className="animate-spin" />}
                    {isUpdatingDefault ? "Updating..." : "Save Default Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
