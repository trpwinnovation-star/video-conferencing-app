"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { apiResetPassword } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const msg = await apiResetPassword(token, password);
      setSuccess(msg);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9FA] flex items-center justify-center p-6 text-stone-900">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center mb-12">
          <Image
            src="/logo_betel.png"
            alt="BetelMeet Logo"
            width={200}
            height={50}
            className="object-contain mix-blend-multiply"
            priority
          />
        </div>

        <div className="bg-white border border-stone-200/80 rounded-2xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-stone-900 mb-1 flex items-center gap-2">
            <Lock size={20} className="text-[#c16d18]" />
            Reset Password
          </h1>
          <p className="text-stone-500 text-sm mb-8">Enter your new password below</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-stone-600 mb-2">New Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/15 focus:border-[#c16d18] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-600 mb-2">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/15 focus:border-[#c16d18] transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-600 text-sm font-semibold">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-green-700 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} />
                {success} (Redirecting to login...)
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token || success.length > 0}
              className="w-full py-3.5 bg-[#c16d18] hover:bg-[#a0560e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#c16d18]/25 active:scale-95 cursor-pointer"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          <p className="text-center text-stone-500 text-sm mt-6">
            Remember your password?{" "}
            <Link href="/login" className="text-[#c16d18] hover:text-[#965310] font-bold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FBF9FA] flex items-center justify-center p-6 text-stone-900">
        <Loader2 size={32} className="animate-spin text-[#c16d18]" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
