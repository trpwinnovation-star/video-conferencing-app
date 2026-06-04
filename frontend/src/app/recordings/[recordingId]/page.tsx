"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiGetRecordingInfo, apiDownloadRecording } from "@/lib/api";

interface RecordingInfo {
  id: string;
  roomId: string;
  duration: number | null;
  createdAt: string;
  status: string;
  downloadCount: number;
  downloadExpiresAt: string | null;
  fileSize: number | null;
}

export default function RecordingPage() {
  const params = useParams();
  const recordingId = params.recordingId as string;

  const [recording, setRecording] = useState<RecordingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Download-specific state
  const [dlState, setDlState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [dlError, setDlError] = useState('');

  useEffect(() => {
    if (!recordingId) return;

    const fetchInfo = async () => {
      try {
        // Uses the /info endpoint — does NOT increment downloadCount
        const data = await apiGetRecordingInfo(recordingId);
        setRecording(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load recording');
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [recordingId]);

  const handleDownload = async () => {
    if (!recording) return;
    setDlState('loading');
    setDlError('');
    try {
      const fileName = `Recording-${recording.roomId}-${new Date(recording.createdAt).toISOString().slice(0, 10)}.webm`;
      // apiDownloadRecording streams from backend → blob → triggers save dialog internally
      const { downloadCount } = await apiDownloadRecording(recordingId, fileName);

      // Update local counter
      setRecording(prev => prev ? { ...prev, downloadCount } : prev);

      setDlState('done');
      setTimeout(() => setDlState('idle'), 3000);
    } catch (err: any) {
      setDlError(err.message || 'Download failed');
      setDlState('error');
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9FA] flex flex-col items-center justify-center text-stone-900">
        <Loader2 className="w-10 h-10 animate-spin text-[#c16d18] mb-4" />
        <h2 className="text-lg font-bold">Loading recording…</h2>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="min-h-screen bg-[#FBF9FA] flex flex-col items-center justify-center p-6 text-stone-900">
        <div className="max-w-md w-full bg-white border border-stone-200/80 rounded-2xl p-8 text-center shadow-xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Recording Unavailable</h1>
          <p className="text-stone-500 mb-8">{error || "This recording does not exist or is still processing."}</p>
          <a href="/" className="inline-block bg-[#c16d18] hover:bg-[#a0560e] text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  const isExpired = recording.downloadExpiresAt && new Date(recording.downloadExpiresAt) < new Date();
  const limitReached = recording.downloadCount >= 3;
  const canDownload = recording.status === 'completed' && !isExpired && !limitReached;

  return (
    <div className="min-h-screen bg-[#FBF9FA] text-stone-800 p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 mb-2">Meeting Recording</h1>
            <div className="text-stone-500 flex items-center gap-2 text-sm font-medium">
              <span className="bg-[#c16d18]/10 text-[#c16d18] border border-[#c16d18]/20 px-2.5 py-1 rounded-lg font-bold">
                Room: {recording.roomId}
              </span>
              <span>•</span>
              <span>{new Date(recording.createdAt).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}</span>
            </div>
          </div>

          {/* Download Button — only increments count on click */}
          <div className="flex flex-col items-end gap-2">
            {canDownload ? (
              <button
                id="download-recording-btn"
                onClick={handleDownload}
                disabled={dlState === 'loading'}
                className={`flex items-center justify-center gap-2 font-bold py-2.5 px-5 rounded-xl transition-all shadow-lg active:scale-95
                  ${dlState === 'done'
                    ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                    : dlState === 'loading'
                    ? 'bg-stone-200 text-stone-400 cursor-wait'
                    : 'bg-[#c16d18] hover:bg-[#a0560e] text-white shadow-[#c16d18]/25'
                  }`}
              >
                {dlState === 'loading' ? (
                  <><Loader2 size={18} className="animate-spin" /> Downloading…</>
                ) : dlState === 'done' ? (
                  <><CheckCircle2 size={18} /> Downloaded!</>
                ) : (
                  <><Download size={18} /> Download Video</>
                )}
              </button>
            ) : (
              <button disabled className="flex items-center gap-2 bg-stone-200 text-stone-400 font-bold py-2.5 px-5 rounded-xl cursor-not-allowed">
                {isExpired ? '⛔ Link Expired' : '🚫 Limit Reached (3/3)'}
              </button>
            )}

            {/* Download counter */}
            {recording.status === 'completed' && (
              <span className={`text-xs font-semibold ${limitReached ? 'text-red-500' : 'text-stone-400'}`}>
                {recording.downloadCount} / 3 downloads used
              </span>
            )}

            {/* Download error */}
            {dlError && (
              <p className="text-xs text-red-600 max-w-xs text-right">{dlError}</p>
            )}
          </div>
        </header>

        {/* Info banner — video must be downloaded to play */}
        <div className="bg-white border border-stone-200/80 rounded-3xl overflow-hidden shadow-xl relative aspect-video flex flex-col items-center justify-center gap-4 text-stone-400">
          <Download size={48} className="opacity-20" />
          <p className="text-sm font-semibold text-center max-w-xs">
            {dlState === 'done'
              ? '✅ Download complete! Open the file in your media player to watch.'
              : canDownload
              ? 'Click “Download Video” above to save the recording to your device.'
              : isExpired
              ? '⛔ This recording link has expired.'
              : '🚫 Download limit reached — no more downloads available.'}
          </p>
        </div>

        <div className="mt-12 bg-white/80 border border-stone-200/80 rounded-2xl p-6 md:p-8 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900 mb-4">Security Information</h3>
          <p className="text-sm text-stone-600 max-w-3xl leading-relaxed">
            This recording is securely stored and accessed via a temporary, cryptographically signed URL.
            Each download uses one of your <strong>3 allowed downloads</strong>. The link expires{' '}
            {recording.downloadExpiresAt
              ? `on ${new Date(recording.downloadExpiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
              : 'after 5 days'}.
            Please download and save a local copy to retain access.
          </p>
        </div>
      </div>
    </div>
  );
}
