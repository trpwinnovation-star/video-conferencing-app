"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Video, Eye, EyeOff, Loader2 } from "lucide-react";
import { apiRegister } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await apiRegister(name, email, password);
      await refresh();
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9FA] flex items-center justify-center p-6 text-stone-900">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="p-2.5 bg-[#c16d18] rounded-xl shadow-md shadow-[#c16d18]/25 animate-pulse">
            <Video size={24} className="text-white" />
          </div>
          <span className="text-stone-900 font-extrabold text-2xl tracking-tight">MeetSpace</span>
        </div>

        <div className="bg-white border border-stone-200/80 rounded-2xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-stone-900 mb-1">Create an account</h1>
          <p className="text-stone-500 text-sm mb-8">Join MeetSpace to start hosting meetings</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-stone-600 mb-2">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/15 focus:border-[#c16d18] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-600 mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/15 focus:border-[#c16d18] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-600 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/15 focus:border-[#c16d18] transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#c16d18] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-600 text-sm font-semibold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#c16d18] hover:bg-[#a0560e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#c16d18]/25 active:scale-95 cursor-pointer"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-stone-500 text-sm mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-[#c16d18] hover:text-[#965310] font-bold">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-stone-500 text-sm mt-6">
          <Link href="/" className="hover:text-[#c16d18] font-medium transition-colors">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
