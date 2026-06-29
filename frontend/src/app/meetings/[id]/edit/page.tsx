'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, Users, ArrowLeft, Loader2, Save, AlertCircle, ShieldAlert, Video, Download, CheckCircle2 } from 'lucide-react';
import { apiGetScheduledMeetingDetails, apiUpdateScheduledMeeting, apiGetMeetingRecordings, apiDownloadRecording } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import Image from 'next/image';

interface Recording {
  id: string;
  meetingId: string;
  roomId: string;
  createdAt: string;
  status: string;
  downloadCount: number;
  downloadExpiresAt: string | null;
  duration?: number;
  fileSize?: number;
}

export default function EditMeetingPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'details' | 'recordings'>('details');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [password, setPassword] = useState('');
  const [attendeeEmails, setAttendeeEmails] = useState('');
  const [hostId, setHostId] = useState('');

  // Recordings states
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [recordingsError, setRecordingsError] = useState('');
  const [downloadState, setDownloadState] = useState<Record<string, 'idle' | 'loading' | 'done' | 'error'>>({});
  const [downloadError, setDownloadError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchMeetingDetails = async () => {
      try {
        setIsLoading(true);
        const meeting = await apiGetScheduledMeetingDetails(id);

        setTitle(meeting.title || '');
        setDescription(meeting.description || '');
        setHostId(meeting.hostId || '');

        // Parse date and time from scheduledTime
        if (meeting.scheduledTime) {
          const scheduledDate = new Date(meeting.scheduledTime);

          // Format date as YYYY-MM-DD
          const year = scheduledDate.getFullYear();
          const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
          const day = String(scheduledDate.getDate()).padStart(2, '0');
          setDate(`${year}-${month}-${day}`);

          // Format time as HH:MM
          const hours = String(scheduledDate.getHours()).padStart(2, '0');
          const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
          setTime(`${hours}:${minutes}`);
        }

        setDurationMinutes(meeting.durationMinutes || 60);
        setPassword('');

        if (meeting.attendees) {
          const emails = meeting.attendees.map((a: any) => a.email).join(', ');
          setAttendeeEmails(emails);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load meeting details');
      } finally {
        setIsLoading(false);
      }
    };

    if (user && id) {
      fetchMeetingDetails();
    }
  }, [user, id]);

  useEffect(() => {
    if (activeTab === 'recordings' && id) {
      loadRecordings();
    }
  }, [activeTab, id]);

  const loadRecordings = async () => {
    try {
      setRecordingsLoading(true);
      setRecordingsError('');
      const data = await apiGetMeetingRecordings(id);
      setRecordings(data.recordings || []);
    } catch (err: any) {
      setRecordingsError(err.message || 'Failed to load recordings');
    } finally {
      setRecordingsLoading(false);
    }
  };

  const handleDownload = async (rec: Recording) => {
    setDownloadState(prev => ({ ...prev, [rec.id]: 'loading' }));
    setDownloadError(prev => ({ ...prev, [rec.id]: '' }));
    try {
      const fileName = `Recording-${rec.roomId}-${new Date(rec.createdAt).toISOString().slice(0, 10)}.webm`;
      const { downloadCount } = await apiDownloadRecording(rec.id, fileName);

      setRecordings(prev =>
        prev.map(r => r.id === rec.id ? { ...r, downloadCount } : r)
      );
      setDownloadState(prev => ({ ...prev, [rec.id]: 'done' }));

      setTimeout(() => {
        setDownloadState(prev => ({ ...prev, [rec.id]: 'idle' }));
      }, 3000);
    } catch (err: any) {
      setDownloadError(prev => ({ ...prev, [rec.id]: err.message || 'Download failed' }));
      setDownloadState(prev => ({ ...prev, [rec.id]: 'error' }));
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsSaving(true);

    try {
      if (!title.trim()) {
        throw new Error('Meeting title is required');
      }
      if (!date) {
        throw new Error('Date is required');
      }

      const scheduledDateTime = new Date(`${date}T${time}`);
      const now = new Date();

      if (scheduledDateTime.getTime() + 5 * 60 * 1000 <= now.getTime()) {
        throw new Error('Scheduled time must be in the future');
      }

      const emails = attendeeEmails
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      const updatePayload: any = {
        title,
        description: description || null,
        scheduledTime: scheduledDateTime.toISOString(),
        durationMinutes,
        attendeeEmails: emails,
      };

      if (password) {
        if (password.length < 4) {
          throw new Error('Password must be at least 4 characters');
        }
        updatePayload.password = password;
      }

      await apiUpdateScheduledMeeting(id, updatePayload);
      setSuccess(true);

      setTimeout(() => {
        router.push('/meetings');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update meeting');
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9FA] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#c16d18]" size={32} />
      </div>
    );
  }

  if (user && hostId && hostId !== user.id) {
    return (
      <div className="min-h-screen bg-[#FBF9FA] flex items-center justify-center p-4">
        <div className="bg-white border border-stone-200/80 rounded-2xl p-8 text-center shadow-xl max-w-md w-full mx-4">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-extrabold text-stone-900 mb-2">Access Denied</h2>
          <p className="text-stone-500 mb-6 text-sm">
            Only the host of this meeting has permissions to edit its details.
          </p>
          <Link
            href="/meetings"
            className="inline-block bg-[#c16d18] hover:bg-[#a0560e] text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95"
          >
            Back to Meetings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9FA] text-stone-900 pb-12">
      {/* Navbar */}
      <nav className="flex items-center justify-between h-16 px-8 bg-white/80 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-50">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Image src="/logo_betel.png" alt="BetelMeet Logo" width={160} height={40} className="object-contain mix-blend-multiply" />
        </Link>
        <Link href="/meetings" className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 text-sm font-semibold transition-colors">
          <ArrowLeft size={16} />
          Back to Meetings
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto mt-12 px-6">
        <div className="bg-white border border-stone-200/80 rounded-2xl p-6 sm:p-8 shadow-xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 mb-6">
            Edit Scheduled Meeting
          </h1>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-stone-200">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2.5 font-bold transition-all border-b-2 text-sm ${activeTab === 'details'
                ? 'border-[#c16d18] text-[#c16d18]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
                }`}
            >
              Edit Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('recordings')}
              className={`px-4 py-2.5 font-bold transition-all border-b-2 text-sm ${activeTab === 'recordings'
                ? 'border-[#c16d18] text-[#c16d18]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
                }`}
            >
              Recordings ({recordings.length})
            </button>
          </div>

          {activeTab === 'details' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Team Sync"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c16d18]/40 focus:border-[#c16d18] bg-stone-50/50"
                  disabled={isSaving}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add an optional description..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c16d18]/40 focus:border-[#c16d18] bg-stone-50/50"
                  disabled={isSaving}
                />
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2 flex items-center gap-2">
                    <Calendar size={16} className="text-[#c16d18]" /> Date *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c16d18]/40 focus:border-[#c16d18] bg-stone-50/50"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2 flex items-center gap-2">
                    <Clock size={16} className="text-[#c16d18]" /> Time *
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c16d18]/40 focus:border-[#c16d18] bg-stone-50/50"
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">
                  Duration
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c16d18]/40 focus:border-[#c16d18] bg-stone-50/50"
                  disabled={isSaving}
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                </select>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">
                  New Meeting Password (leave blank to keep current)
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a new secure password"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c16d18]/40 focus:border-[#c16d18] bg-stone-50/50"
                  disabled={isSaving}
                />
              </div>

              {/* Attendee Emails */}
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2 flex items-center gap-2">
                  <Users size={16} className="text-[#c16d18]" /> Attendee Emails (comma separated)
                </label>
                <input
                  type="text"
                  value={attendeeEmails}
                  onChange={(e) => setAttendeeEmails(e.target.value)}
                  placeholder="colleague@example.com, client@company.com"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c16d18]/40 focus:border-[#c16d18] bg-stone-50/50"
                  disabled={isSaving}
                />
                <p className="text-xs text-stone-500 mt-1.5">
                  Separate multiple email addresses with commas.
                </p>
              </div>


              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-600 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <span>✓ Meeting updated successfully! Redirecting...</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t border-stone-100">
                <button
                  type="submit"
                  disabled={isSaving || success}
                  className="flex-1 bg-[#c16d18] hover:bg-[#a0560e] disabled:bg-stone-300 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} /> Save Changes
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/meetings')}
                  disabled={isSaving}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 disabled:bg-stone-50 text-stone-700 font-bold py-3 px-4 rounded-xl transition-all border border-stone-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {recordingsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 size={32} className="animate-spin text-[#c16d18]" />
                </div>
              ) : recordingsError ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <AlertCircle size={16} />
                  {recordingsError}
                </div>
              ) : recordings.length === 0 ? (
                <div className="text-center py-12 bg-stone-50/50 rounded-2xl border border-stone-200/50">
                  <Video className="mx-auto text-stone-400 mb-3" size={40} />
                  <p className="text-sm font-bold text-stone-600">No recordings found for this meeting.</p>
                  <p className="text-xs text-stone-400 mt-1">Recordings are available once a meeting ends.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recordings.map((rec) => {
                    const isExpired = rec.downloadExpiresAt && new Date(rec.downloadExpiresAt) < new Date();
                    const limitReached = rec.downloadCount >= 3;
                    const canDownload = rec.status === 'completed' && !isExpired && !limitReached;
                    const dlState = downloadState[rec.id] || 'idle';
                    const dlErr = downloadError[rec.id] || '';

                    return (
                      <div
                        key={rec.id}
                        className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${rec.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                              rec.status === 'failed' ? 'bg-red-50 text-red-500' :
                                'bg-stone-100 text-stone-500'
                              }`}>
                              {rec.status}
                            </span>
                            <span className="text-xs text-stone-400 font-bold uppercase">
                              {new Date(rec.createdAt).toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric', year: 'numeric',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-stone-500 font-semibold">
                            <span>{formatFileSize(rec.fileSize)}</span>
                            {rec.status === 'completed' && (
                              <span>• Downloads: {rec.downloadCount}/3</span>
                            )}
                          </div>
                          {dlErr && (
                            <div className="text-[11px] text-red-600 font-bold mt-1.5 flex items-center gap-1">
                              <AlertCircle size={10} /> {dlErr}
                            </div>
                          )}
                        </div>

                        <div className="shrink-0">
                          {rec.status === 'completed' ? (
                            canDownload ? (
                              <button
                                onClick={() => handleDownload(rec)}
                                disabled={dlState === 'loading'}
                                className={`py-2 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border ${dlState === 'done'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
                                  : dlState === 'loading'
                                    ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-wait'
                                    : 'bg-[#c16d18]/10 hover:bg-[#c16d18] text-[#c16d18] hover:text-white border-[#c16d18]/20 hover:border-[#c16d18] active:scale-95 cursor-pointer'
                                  }`}
                              >
                                {dlState === 'loading' ? (
                                  <>
                                    <Loader2 size={12} className="animate-spin" /> Downloading...
                                  </>
                                ) : dlState === 'done' ? (
                                  <>
                                    <CheckCircle2 size={12} /> Downloaded
                                  </>
                                ) : (
                                  <>
                                    <Download size={12} /> Download
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-stone-400 border border-stone-100 bg-stone-50 px-3 py-1.5 rounded-xl">
                                {isExpired ? 'Expired' : 'Limit Reached'}
                              </span>
                            )
                          ) : rec.status === 'failed' ? (
                            <span className="text-xs font-bold text-red-500 border border-red-50 bg-red-50/20 px-3 py-1.5 rounded-xl">
                              Failed
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-stone-400 border border-stone-100 bg-stone-50/50 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                              <Loader2 size={12} className="animate-spin" /> Processing
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
