"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { 
  User as UserIcon, 
  Trash2, 
  UserPlus, 
  Loader2, 
  ArrowLeft, 
  CheckCircle2, 
  Shield, 
  Mail, 
  Lock,
  Plus
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiListUsers, apiCreateUser, apiDeleteUser, apiApproveUser, apiRejectUser, User } from "@/lib/api";

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create User form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<'USER' | 'ADMIN'>('USER');
  const [newUserPassword, setNewUserPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'ADMIN') {
        router.push("/");
      } else {
        fetchUsers();
      }
    }
  }, [user, authLoading, router]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setError("");
    try {
      const data = await apiListUsers();
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message || "Failed to load users list.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    if (!newUserName || !newUserEmail || !newUserPassword) {
      setFormError("All fields are required.");
      setIsSubmitting(false);
      return;
    }

    if (newUserPassword.length < 6) {
      setFormError("Password must be at least 6 characters.");
      setIsSubmitting(false);
      return;
    }

    try {
      await apiCreateUser({
        name: newUserName,
        email: newUserEmail,
        role: newUserRole,
        password: newUserPassword,
      });

      setSuccess(`User "${newUserName}" created successfully.`);
      setShowAddForm(false);
      
      // Clear form
      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("USER");
      setNewUserPassword("");

      // Refresh list
      fetchUsers();

      // Clear success alert after 3 seconds
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setFormError(err.message || "Failed to create user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    setError("");
    try {
      await apiDeleteUser(userId);
      setSuccess("User deleted successfully.");
      setUsers(users.filter(u => u.id !== userId));
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to delete user.");
    }
  };

  const handleApproveUser = async (userId: string) => {
    setError("");
    try {
      await apiApproveUser(userId);
      setSuccess("User approved successfully and email sent.");
      fetchUsers();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to approve user.");
    }
  };

  const handleRejectUser = async (userId: string) => {
    if (!confirm("Are you sure you want to reject and delete this user registration?")) {
      return;
    }
    setError("");
    try {
      await apiRejectUser(userId);
      setSuccess("User rejected successfully and email sent.");
      fetchUsers();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to reject user.");
    }
  };

  if (authLoading || (user && user.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen bg-[#FBF9FA] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#c16d18]" size={32} />
      </div>
    );
  }

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

      <div className="max-w-6xl mx-auto mt-12 px-6">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 flex items-center gap-2">
              <Shield className="text-[#c16d18]" size={28} />
              Admin Portal
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Create and manage users authorized to schedule and join meetings.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center justify-center gap-2 bg-[#c16d18] hover:bg-[#a0560e] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Plus size={18} />
            <span>Create New User</span>
          </button>
        </div>

        {/* Alerts */}
        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 px-4 py-3 text-green-700 text-sm font-medium flex items-center gap-2 rounded-r-md mb-6 animate-fade-in shadow-sm">
            <CheckCircle2 size={18} />
            {success}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 px-4 py-3 text-red-700 text-sm font-medium flex items-center gap-2 rounded-r-md mb-6 animate-fade-in shadow-sm">
            {error}
          </div>
        )}

        {/* Create User Form / Section */}
        {showAddForm && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-md mb-8 animate-slide-down">
            <h2 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
              <UserPlus size={20} className="text-[#c16d18]" />
              Create New Account
            </h2>
            <form onSubmit={handleCreateUser} className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5 flex items-center gap-1">
                    <UserIcon size={14} className="text-stone-400" /> Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/20 focus:border-[#c16d18] transition-all shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5 flex items-center gap-1">
                    <Mail size={14} className="text-stone-400" /> Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/20 focus:border-[#c16d18] transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5 flex items-center gap-1">
                    <Lock size={14} className="text-stone-400" /> Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/20 focus:border-[#c16d18] transition-all shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5 flex items-center gap-1">
                    <Shield size={14} className="text-stone-400" /> Role
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'USER' | 'ADMIN')}
                    className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#c16d18]/20 focus:border-[#c16d18] transition-all shadow-sm"
                  >
                    <option value="USER">User (Standard)</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
              </div>

              {formError && (
                <div className="md:col-span-2 bg-red-50 border-l-4 border-red-500 px-4 py-3 text-red-700 text-sm font-medium rounded-r-md">
                  {formError}
                </div>
              )}

              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="py-2.5 px-5 border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-lg font-bold transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-6 bg-[#c16d18] hover:bg-[#a0560e] disabled:opacity-50 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
                >
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  <span>Save User</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table / List */}
        <div className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-stone-150 bg-stone-50/50 flex justify-between items-center">
            <h2 className="font-bold text-stone-800 text-lg">System Users ({users.length})</h2>
            <button
              onClick={fetchUsers}
              className="text-stone-500 hover:text-stone-900 text-sm font-semibold transition-colors"
            >
              Refresh List
            </button>
          </div>

          {loadingUsers ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-[#c16d18]" size={28} />
              <span className="text-stone-500 text-sm font-semibold">Fetching user list...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center text-stone-500">
              No users found. Try creating a new one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {users.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#c16d18]/10 border border-[#c16d18]/20 flex items-center justify-center text-[#c16d18] font-bold text-sm">
                            {item.name[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-stone-950 block leading-tight">{item.name}</span>
                            <span className="text-xs text-stone-400">ID: {item.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4.5 text-stone-600 text-sm font-medium">
                        {item.email}
                      </td>
                      <td className="px-6 py-4.5">
                        {item.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold uppercase tracking-wide">
                            <Shield size={11} /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 bg-stone-100 text-stone-600 border border-stone-200 rounded-full text-xs font-bold uppercase tracking-wide">
                            User
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4.5">
                        {item.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-bold uppercase tracking-wide">
                            <CheckCircle2 size={11} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-xs font-bold uppercase tracking-wide">
                            <Loader2 size={11} className="animate-spin" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4.5 text-right flex justify-end gap-2">
                        {item.id === user?.id ? (
                          <span className="text-xs text-stone-400 font-semibold italic pr-2">Your Account</span>
                        ) : (
                          <>
                            {!item.isActive && (
                              <>
                                <button
                                  onClick={() => handleApproveUser(item.id)}
                                  className="p-1.5 px-3 text-white bg-green-500 hover:bg-green-600 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center text-xs font-bold shadow-sm"
                                  title="Approve User"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectUser(item.id)}
                                  className="p-1.5 px-3 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center text-xs font-bold shadow-sm"
                                  title="Reject User"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteUser(item.id)}
                              className="p-2 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all cursor-pointer inline-flex items-center justify-center"
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
