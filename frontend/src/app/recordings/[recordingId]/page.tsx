"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Download, AlertCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecordingData {
  id: string;
  roomId: string;
  duration: number | null;
  createdAt: string;
  signedUrl: string;
}

export default function RecordingPage() {
  const params = useParams();
  const recordingId = params.recordingId as string;

  const [recording, setRecording] = useState<RecordingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordingId) return;

    const fetchRecording = async () => {
      try {
        let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        if (baseUrl.endsWith('/api')) baseUrl = baseUrl.slice(0, -4);
        
        const res = await fetch(`${baseUrl}/api/recording/${recordingId}`);
        
        if (!res.ok) {
          let errMsg = `Failed to load recording (HTTP ${res.status})`;
          try {
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const data = await res.json();
              errMsg = data.error || errMsg;
            } else {
              const text = await res.text();
              console.error("Non-JSON error response:", text);
            }
          } catch (e) {
            console.error("Failed to parse error response", e);
          }
          throw new Error(errMsg);
        }
        
        const data = await res.json();
        setRecording(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRecording();
  }, [recordingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <h2 className="text-lg font-medium">Loading recording...</h2>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Recording Unavailable</h1>
          <p className="text-slate-400 mb-8">{error || "This recording does not exist or is still processing."}</p>
          <a href="/" className="inline-block bg-amber-600 hover:bg-amber-500 text-white font-medium py-2 px-6 rounded-lg transition-colors">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Meeting Recording</h1>
            <p className="text-slate-400 flex items-center gap-2">
              <span className="bg-slate-800 px-2 py-1 rounded text-xs font-mono">Room: {recording.roomId}</span>
              <span>•</span>
              <span>{new Date(recording.createdAt).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}</span>
            </p>
          </div>
          
          <a 
            href={recording.signedUrl} 
            download={`Recording-${recording.roomId}.webm`}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95"
          >
            <Download size={18} />
            Download Video
          </a>
        </header>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative aspect-video group">
          <video 
            src={recording.signedUrl} 
            controls 
            className="w-full h-full object-contain bg-black"
            controlsList="nodownload"
            poster="/placeholder-video.jpg"
          />
        </div>

        <div className="mt-12 bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 md:p-8">
          <h3 className="text-lg font-semibold text-white mb-4">Security Information</h3>
          <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
            This recording is securely stored and accessed via a temporary, cryptographically signed URL. 
            The link embedded in the video player will expire for security purposes. If you need to access this 
            recording later, please retain the original link sent to your email or download a local copy using 
            the button above.
          </p>
        </div>
      </div>
    </div>
  );
}
