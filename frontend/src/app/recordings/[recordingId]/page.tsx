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
        const contentType = res.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");
        
        if (!res.ok) {
          let errMsg = `Failed to load recording (HTTP ${res.status})`;
          if (isJson) {
            const data = await res.json();
            errMsg = data.error || errMsg;
            if (data.details) errMsg = `${errMsg}: ${data.details}`;
          } else {
            const text = await res.text();
            console.error("Non-JSON error response:", text);
          }
          throw new Error(errMsg);
        }
        
        const data = await res.json();
        if (res.status === 202 || data.status !== 'completed') {
          throw new Error(data.details || `Recording status: ${data.status || 'processing'}. Please try again shortly.`);
        }
        
        setRecording(data);
      } catch (err: any) {
        setError(err.message);
        // Try to extract technical details if available
        if (err.details) {
          setError(`${err.message}: ${err.details}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRecording();
  }, [recordingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9FA] flex flex-col items-center justify-center text-stone-900">
        <Loader2 className="w-10 h-10 animate-spin text-[#c16d18] mb-4" />
        <h2 className="text-lg font-bold">Loading recording...</h2>
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
          <a href="/" className="inline-block bg-[#c16d18] hover:bg-[#a0560e] text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md shadow-[#c16d18]/25 active:scale-95 cursor-pointer">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9FA] text-stone-800 p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 mb-2">Meeting Recording</h1>
            <div className="text-stone-500 flex items-center gap-2 text-sm font-medium">
              <span className="bg-[#c16d18]/10 text-[#c16d18] border border-[#c16d18]/20 px-2.5 py-1 rounded-lg font-bold">Room: {recording.roomId}</span>
              <span>•</span>
              <span>{new Date(recording.createdAt).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}</span>
            </div>
          </div>
          
          <a 
            href={recording.signedUrl} 
            download={`Recording-${recording.roomId}.webm`}
            className="flex items-center justify-center gap-2 bg-[#c16d18] hover:bg-[#a0560e] text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-lg hover:shadow-[#c16d18]/25 active:scale-95 cursor-pointer"
          >
            <Download size={18} />
            Download Video
          </a>
        </header>

        <div className="bg-white border border-stone-200/80 rounded-3xl overflow-hidden shadow-xl relative aspect-video group">
          <video 
            src={recording.signedUrl} 
            controls 
            className="w-full h-full object-contain bg-stone-950"
            controlsList="nodownload"
            poster="/placeholder-video.jpg"
          />
        </div>

        <div className="mt-12 bg-white/80 border border-stone-200/80 rounded-2xl p-6 md:p-8 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900 mb-4">Security Information</h3>
          <p className="text-sm text-stone-600 max-w-3xl leading-relaxed">
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
