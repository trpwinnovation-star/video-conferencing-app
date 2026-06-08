"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Video, Download, Loader2, ArrowLeft, Calendar, Clock, AlertCircle, Plus, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiGetMyRecordings, apiDownloadRecording } from "@/lib/api";
import ScheduleMeetingModal from "@/components/ScheduleMeetingModal";
import ScheduledMeetingsList from "@/components/ScheduledMeetingsList";

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

export default function MeetingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'scheduled' | 'recordings'>('scheduled');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [refreshScheduledMeetings, setRefreshScheduledMeetings] = useState(false);
  // Per-recording download state: 'idle' | 'loading' | 'done' | 'error'
  const [downloadState, setDownloadState] = useState<Record<string, 'idle' | 'loading' | 'done' | 'error'>>({});
  const [downloadError, setDownloadError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchRecordings = async () => {
      if (!user) return;
      try {
        const data = await apiGetMyRecordings();
        setRecordings(data.recordings || []);
      } catch (err: any) {
        setError(err.message || "Failed to load meetings");
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchRecordings();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#FBF9FA] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#c16d18]" size={32} />
      </div>
    );
  }

  if (!user) return null;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "Unknown";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleMeetingScheduled = () => {
    setIsScheduleModalOpen(false);
    setRefreshScheduledMeetings(true);
    setTimeout(() => setRefreshScheduledMeetings(false), 100);
  };

  /**
   * Called when the host clicks "Download Recording".
   * Fetches a signed URL from the backend (which increments downloadCount)
   * then triggers a browser file download — no page navigation needed.
   */
  const handleDownload = async (rec: Recording) => {
    setDownloadState(prev => ({ ...prev, [rec.id]: 'loading' }));
    setDownloadError(prev => ({ ...prev, [rec.id]: '' }));
    try {
      const fileName = `Recording-${rec.roomId}-${new Date(rec.createdAt).toISOString().slice(0, 10)}.webm`;
      // apiDownloadRecording now handles blob fetching, anchor creation, and cleanup internally
      const { downloadCount } = await apiDownloadRecording(rec.id, fileName);

      // Update local counter so the progress bar updates immediately
      setRecordings(prev =>
        prev.map(r => r.id === rec.id ? { ...r, downloadCount } : r)
      );
      setDownloadState(prev => ({ ...prev, [rec.id]: 'done' }));

      // Reset "done" check mark after 3 seconds
      setTimeout(() => {
        setDownloadState(prev => ({ ...prev, [rec.id]: 'idle' }));
      }, 3000);
    } catch (err: any) {
      setDownloadError(prev => ({ ...prev, [rec.id]: err.message || 'Download failed' }));
      setDownloadState(prev => ({ ...prev, [rec.id]: 'error' }));
      // Re-fetch to get the authoritative count from the server
      const fresh = await apiGetMyRecordings().catch(() => null);
      if (fresh) setRecordings(fresh.recordings || []);
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

      <div className="max-w-5xl mx-auto mt-12 px-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 flex items-center gap-3">
            <Calendar className="text-[#c16d18]" size={28} />
            My Meetings
          </h1>
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="flex items-center gap-2 bg-[#c16d18] hover:bg-[#a0560e] text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95"
          >
            <Plus size={20} />
            Schedule Meeting
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-600 text-sm font-semibold mb-6 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-stone-200">
          <button
            id="tab-scheduled"
            onClick={() => setActiveTab('scheduled')}
            className={`px-4 py-3 font-semibold transition-all border-b-2 ${activeTab === 'scheduled'
              ? 'border-[#c16d18] text-[#c16d18]'
              : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
          >
            <Calendar size={16} className="inline-block mr-2" />
            Scheduled Meetings
          </button>
          <button
            id="tab-recordings"
            onClick={() => setActiveTab('recordings')}
            className={`px-4 py-3 font-semibold transition-all border-b-2 ${activeTab === 'recordings'
              ? 'border-[#c16d18] text-[#c16d18]'
              : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
          >
            <Video size={16} className="inline-block mr-2" />
            Recordings
            {recordings.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-[#c16d18]/10 text-[#c16d18] rounded-full align-middle">
                {recordings.length}
              </span>
            )}
          </button>
        </div>

        {/* Scheduled Meetings Tab */}
        {activeTab === 'scheduled' && (
          <div>
            <ScheduledMeetingsList refresh={refreshScheduledMeetings} />
          </div>
        )}

        {/* Recordings Tab */}
        {activeTab === 'recordings' && (
          <>
            {recordings.length === 0 && !error ? (
              <div className="bg-white border border-stone-200/80 rounded-2xl p-12 text-center shadow-xl">
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Video className="text-stone-400" size={28} />
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">No recordings yet</h3>
                <p className="text-stone-500 max-w-sm mx-auto">
                  Meetings you host and record will appear here.
                </p>
                <Link
                  href="/"
                  className="mt-6 inline-flex py-2.5 px-6 bg-[#c16d18] hover:bg-[#a0560e] text-white rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Host a Meeting
                </Link>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {recordings.map((rec) => {
                  const isExpired = rec.downloadExpiresAt && new Date(rec.downloadExpiresAt) < new Date();
                  const limitReached = rec.downloadCount >= 3;
                  const canDownload = rec.status === 'completed' && !isExpired && !limitReached;
                  const dlState = downloadState[rec.id] || 'idle';
                  const dlErr = downloadError[rec.id] || '';

                  // Days until expiry (null if no expiry date or already expired)
                  const daysLeft = rec.downloadExpiresAt && !isExpired
                    ? Math.ceil((new Date(rec.downloadExpiresAt).getTime() - Date.now()) / 86_400_000)
                    : null;

                  return (
                    <div
                      key={rec.id}
                      className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow flex flex-col"
                    >
                      {/* ── Card Header ── */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="min-w-0 flex-1 pr-3">
                          <h3 className="font-bold text-stone-900 truncate">{rec.roomId}</h3>
                          <p className="text-xs font-semibold text-stone-400 mt-0.5 uppercase tracking-wider">
                            {new Date(rec.createdAt).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </p>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${rec.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                            rec.status === 'failed' ? 'bg-red-50 text-red-500' :
                              'bg-stone-100 text-stone-500'
                          }`}>
                          {rec.status}
                        </span>
                      </div>

                      {/* ── File Metadata ── */}
                      <div className="flex flex-col gap-1.5 mb-4 text-sm text-stone-600">
                        {/* <div className="flex items-center gap-2">
                          <Clock size={13} className="text-stone-400 shrink-0" />
                          <span>{formatDuration(rec.duration)}</span>
                        </div> */}
                        <div className="flex items-center gap-2">
                          <Video size={13} className="text-stone-400 shrink-0" />
                          <span>{formatFileSize(rec.fileSize)}</span>
                        </div>
                      </div>

                      {/* ── Download Limit Panel (completed only) ── */}
                      {rec.status === 'completed' && (
                        <div className="mb-4 p-3 rounded-xl bg-stone-50 border border-stone-100">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-stone-500">Downloads used</span>
                            <span className={`text-[11px] font-bold tabular-nums ${limitReached ? 'text-red-500' : 'text-[#c16d18]'}`}>
                              {rec.downloadCount} / 3
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${limitReached ? 'bg-red-400' :
                                  rec.downloadCount >= 2 ? 'bg-amber-400' : 'bg-[#c16d18]'
                                }`}
                              style={{ width: `${(rec.downloadCount / 3) * 100}%` }}
                            />
                          </div>
                          {/* Expiry */}
                          <div className="mt-2 text-[11px] font-medium">
                            {isExpired ? (
                              <span className="text-red-500">⛔ Link expired</span>
                            ) : daysLeft !== null ? (
                              <span className={daysLeft <= 1 ? 'text-amber-500' : 'text-stone-400'}>
                                🕐 Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* ── Download Error ── */}
                      {dlErr && (
                        <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
                          <AlertCircle size={12} className="mt-0.5 shrink-0" />
                          {dlErr}
                        </div>
                      )}

                      {/* ── Action Button ── */}
                      {rec.status === 'completed' ? (
                        canDownload ? (
                          <button
                            id={`download-btn-${rec.id}`}
                            onClick={() => handleDownload(rec)}
                            disabled={dlState === 'loading'}
                            className={`w-full py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 mt-auto border
                              ${dlState === 'done'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
                                : dlState === 'loading'
                                  ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-wait'
                                  : 'bg-[#c16d18]/10 hover:bg-[#c16d18] text-[#c16d18] hover:text-white border-[#c16d18]/20 hover:border-[#c16d18] active:scale-95 cursor-pointer'
                              }`}
                          >
                            {dlState === 'loading' ? (
                              <><Loader2 size={15} className="animate-spin" /> Downloading…</>
                            ) : dlState === 'done' ? (
                              <><CheckCircle2 size={15} /> Downloaded!</>
                            ) : (
                              <><Download size={15} /> Download Recording</>
                            )}
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full py-2.5 bg-stone-100 text-stone-400 border border-stone-200 rounded-xl font-bold flex items-center justify-center gap-2 mt-auto cursor-not-allowed"
                          >
                            {isExpired ? '⛔ Link Expired' : '🚫 Limit Reached (3/3)'}
                          </button>
                        )
                      ) : rec.status === 'failed' ? (
                        <button
                          disabled
                          className="w-full py-2.5 bg-red-50 text-red-400 border border-red-100 rounded-xl font-bold flex items-center justify-center gap-2 mt-auto cursor-not-allowed"
                        >
                          <AlertCircle size={15} /> Processing Failed
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full py-2.5 bg-stone-50 text-stone-400 border border-stone-200 rounded-xl font-bold flex items-center justify-center gap-2 mt-auto cursor-not-allowed"
                        >
                          <Loader2 size={15} className="animate-spin" /> Processing…
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onMeetingScheduled={handleMeetingScheduled}
      />
    </div>
  );
}
