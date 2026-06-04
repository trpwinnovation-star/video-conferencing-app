import { useState, useRef, useCallback, useEffect } from 'react';

interface UseRecordingOptions {
  roomName: string;
  userEmail: string;
  userName?: string;
  onSuccess?: (filePath: string) => void;
  onError?: (error: string) => void;
  onWarning?: (message: string) => void;
  onRecordingReady?: (blob: Blob, duration: number) => void;
}

const MAX_RECORDING_SECONDS = 3600; // 1 hour
const WARNING_AT_SECONDS = 3000; // 50 minutes

export function useRecording({ roomName, userEmail, userName = 'local-user', onSuccess, onError, onWarning, onRecordingReady }: UseRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const localChunksRef = useRef<Blob[]>([]);
  
  // Track continuous recording session
  const recordingSessionRef = useRef<{
    recordingId: string;
    meetingId: string;
    chunkIndex: number;
    totalChunks: number;
  } | null>(null);

  // Track whether warning was already shown
  const warningShownRef = useRef(false);
  // Ref to access latest stopRecording in timer without circular deps
  const autoStopRef = useRef<(() => void) | null>(null);

  const startTimer = () => {
    setDuration(0);
    warningShownRef.current = false;
    timerRef.current = setInterval(() => {
      setDuration((prev) => {
        const next = prev + 1;
        // 50-minute warning
        if (next === WARNING_AT_SECONDS && !warningShownRef.current) {
          warningShownRef.current = true;
          onWarning?.('⚠️ Only 10 minutes of recording time remaining!');
        }
        // Auto-stop at 1 hour
        if (next >= MAX_RECORDING_SECONDS) {
          autoStopRef.current?.();
        }
        return next;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const getApiUrl = (endpoint: string) => {
    let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    if (baseUrl.endsWith('/api')) baseUrl = baseUrl.slice(0, -4);
    return `${baseUrl}${endpoint}`;
  };

  // Improved uploadChunk with 3x Retry logic for production reliability
  const uploadChunk = async (blob: Blob, chunkIndex: number, meetingId: string, retryCount = 0) => {
    try {
      const formData = new FormData();
      formData.append('chunk', blob);
      formData.append('meetingId', meetingId);
      formData.append('chunkIndex', chunkIndex.toString());

      const res = await fetch(getApiUrl('/api/recording/upload-chunk'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }
      console.log(`[RECORDING] Chunk ${chunkIndex} uploaded successfully`);
    } catch (err) {
      console.warn(`[RECORDING] Chunk ${chunkIndex} upload failed (Attempt ${retryCount + 1}):`, err);
      if (retryCount < 2) {
        // Wait 1s and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        return uploadChunk(blob, chunkIndex, meetingId, retryCount + 1);
      }
      console.error(`[RECORDING] Chunk ${chunkIndex} permanently failed after 3 attempts.`);
    }
  };

  const startRecording = async (audioTracks: MediaStreamTrack[] = []) => {
    localChunksRef.current = [];
    try {
      setError(null);
      
      // Request screen capture (display media) - ONLY video
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 15,
        },
        audio: false 
      });

      streamRef.current = stream;

      // Mix all provided audio tracks using Web Audio API
      if (audioTracks.length > 0) {
        try {
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          const destination = audioContext.createMediaStreamDestination();

          audioTracks.forEach(track => {
            if (track.readyState === 'live') {
              const source = audioContext.createMediaStreamSource(new MediaStream([track]));
              source.connect(destination);
            }
          });

          const mixedTracks = destination.stream.getAudioTracks();
          if (mixedTracks.length > 0) {
            stream.addTrack(mixedTracks[0]);
          }
        } catch (e) {
          console.warn("[RECORDING] Could not mix audio, proceeding without audio", e);
        }
      }

      // Initialize session on backend — send auth token so backend uses the real user name
      const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const initHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) initHeaders['Authorization'] = `Bearer ${authToken}`;

      const initRes = await fetch(getApiUrl('/api/recording/start'), {
        method: 'POST',
        headers: initHeaders,
        body: JSON.stringify({ roomId: roomName, createdBy: userName })
      });
      
      if (!initRes.ok) throw new Error('Could not establish server session');
      
      const { recordingId, meetingId } = await initRes.json();
      
      recordingSessionRef.current = {
        recordingId,
        meetingId,
        chunkIndex: 0,
        totalChunks: 0
      };

      // Use modern mimeTypes
      const options = { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 1000000 };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Keep a local copy for immediate download
          localChunksRef.current.push(event.data);
          
          if (recordingSessionRef.current) {
            const currentIndex = recordingSessionRef.current.chunkIndex;
            recordingSessionRef.current.chunkIndex++;
            recordingSessionRef.current.totalChunks++;
            
            await uploadChunk(event.data, currentIndex, recordingSessionRef.current.meetingId);
          }
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        const finalDuration = duration;
        stopTimer();
        setIsUploading(true);
        
        // Create local blob for immediate download
        if (localChunksRef.current.length > 0) {
          const localBlob = new Blob(localChunksRef.current, { type: 'video/webm' });
          onRecordingReady?.(localBlob, finalDuration);
          localChunksRef.current = [];
        }
        
        stream.getTracks().forEach(track => track.stop());
        
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(console.error);
          audioContextRef.current = null;
        }

        if (recordingSessionRef.current) {
          try {
            await fetch(getApiUrl('/api/recording/finish'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recordingId: recordingSessionRef.current.recordingId,
                roomId: roomName,
                meetingId: recordingSessionRef.current.meetingId,
                totalChunks: recordingSessionRef.current.totalChunks,
                email: userEmail
              })
            });
            onSuccess?.('Recording successfully sent for processing');
          } catch (err) {
            console.error('[RECORDING] Finalize failed:', err);
            onError?.('Server failed to receive recording final signal');
          }
        }
        
        setIsUploading(false);
        recordingSessionRef.current = null;
      };

      // 5-second increments for chunks
      mediaRecorder.start(5000);
      setIsRecording(true);
      startTimer();

      if (stream.getVideoTracks()[0]) {
        stream.getVideoTracks()[0].onended = () => {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        };
      }

    } catch (err: any) {
      console.error("[RECORDING] Startup Error:", err);
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Permission denied. Please allow screen sharing.' 
        : (err.message || 'Failed to start recording');
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Keep autoStopRef updated
  useEffect(() => {
    autoStopRef.current = stopRecording;
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      stopTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  return {
    isRecording,
    isUploading,
    duration,
    error,
    startRecording,
    stopRecording
  };
}
