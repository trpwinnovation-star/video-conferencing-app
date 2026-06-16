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
  // Ref to track active upload promises to prevent race condition on stop
  const uploadPromisesRef = useRef<Promise<void>[]>([]);

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
      formData.append('chunk', blob, 'chunk.webm');
      formData.append('meetingId', meetingId);
      formData.append('chunkIndex', chunkIndex.toString());

      const res = await fetch(getApiUrl('/api/recording/upload-chunk'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[RECORDING] Upload failed with status ${res.status}:`, errorText);
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

      // Request screen capture (display media) - with audio enabled
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 15,
        },
        audio: true, // Capture audio from the selected tab/screen
        // @ts-ignore
        selfBrowserSurface: "include", // Allows sharing the current tab without hiding Window/Screen options
        // @ts-ignore
        surfaceSwitching: "include"
      });

      streamRef.current = stream;

      // Extract any audio tracks captured from the screen share
      const displayAudioTracks = stream.getAudioTracks();
      const allAudioTracks = [...displayAudioTracks, ...audioTracks];

      // Mix all audio tracks (screen audio + room audio) using Web Audio API
      if (allAudioTracks.length > 0) {
        try {
          // Remove raw display audio tracks from stream so we can add the mixed track
          displayAudioTracks.forEach(track => stream.removeTrack(track));

          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          const destination = audioContext.createMediaStreamDestination();

          allAudioTracks.forEach(track => {
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
          console.warn("[RECORDING] Could not mix audio, proceeding with original screen audio", e);
          displayAudioTracks.forEach(track => stream.addTrack(track));
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

      uploadPromisesRef.current = [];

      // Use modern mimeTypes
      const options = { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 1000000 };
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Keep a local copy for immediate download
          localChunksRef.current.push(event.data);

          if (recordingSessionRef.current && recordingSessionRef.current.recordingId === recordingId) {
            const currentIndex = recordingSessionRef.current.chunkIndex;
            recordingSessionRef.current.chunkIndex++;
            recordingSessionRef.current.totalChunks++;

            const uploadPromise = uploadChunk(event.data, currentIndex, recordingSessionRef.current.meetingId);
            uploadPromisesRef.current.push(uploadPromise);

            try {
              await uploadPromise;
            } catch (err) {
              console.error(`[RECORDING] Failed to upload chunk ${currentIndex}`, err);
            }
          }
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        const finalDuration = duration;
        stopTimer();
        setIsUploading(true);

        // Capture the session that is actually stopping
        const stoppingSession = recordingSessionRef.current?.recordingId === recordingId
          ? recordingSessionRef.current
          : { recordingId, meetingId, totalChunks: recordingSessionRef.current?.totalChunks || 0 };

        // Create local blob for immediate download
        if (localChunksRef.current.length > 0) {
          const localBlob = new Blob(localChunksRef.current, { type: 'video/x-matroska' });
          onRecordingReady?.(localBlob, finalDuration);
          localChunksRef.current = [];
        }

        stream.getTracks().forEach(track => track.stop());

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(console.error);
          audioContextRef.current = null;
        }

        // CRITICAL FIX: Wait for all pending chunk uploads to finish BEFORE sending the finish signal!
        if (uploadPromisesRef.current.length > 0) {
          console.log(`[RECORDING] Waiting for ${uploadPromisesRef.current.length} chunks to finish uploading...`);
          await Promise.allSettled(uploadPromisesRef.current);
          console.log(`[RECORDING] All chunks uploaded. Finishing session.`);
        }

        if (stoppingSession) {
          try {
            await fetch(getApiUrl('/api/recording/finish'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recordingId: stoppingSession.recordingId,
                roomId: roomName,
                meetingId: stoppingSession.meetingId,
                totalChunks: stoppingSession.totalChunks,
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
        // Only clear the ref if it hasn't been overwritten by a new recording session
        if (recordingSessionRef.current?.recordingId === recordingId) {
          recordingSessionRef.current = null;
        }
      };

      // 30-second increments for chunks to drastically reduce network load
      mediaRecorder.start(30000);
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
        ? 'Permission denied. Please alloW sharing.'
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
    // Attempt graceful shutdown if user closes tab
    const handleBeforeUnload = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        // We can't await in beforeunload, but we can stop which triggers final chunks
        mediaRecorderRef.current.stop();

        // If we have an active session, try to tell the server we're done
        if (recordingSessionRef.current) {
          const payload = JSON.stringify({
            recordingId: recordingSessionRef.current.recordingId,
            roomId: roomName,
            meetingId: recordingSessionRef.current.meetingId,
            totalChunks: recordingSessionRef.current.totalChunks,
            email: userEmail
          });
          // sendBeacon is non-blocking and works reliably during page unload
          navigator.sendBeacon(getApiUrl('/api/recording/finish'), new Blob([payload], { type: 'application/json' }));
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, [roomName, userEmail]);


  return {
    isRecording,
    isUploading,
    duration,
    error,
    startRecording,
    stopRecording
  };
}
