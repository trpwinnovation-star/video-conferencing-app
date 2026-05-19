import { useState, useRef, useCallback, useEffect } from 'react';

interface UseRecordingOptions {
  roomName: string;
  userEmail: string;
  userName?: string;
  onSuccess?: (filePath: string) => void;
  onError?: (error: string) => void;
}

export function useRecording({ roomName, userEmail, userName = 'local-user', onSuccess, onError }: UseRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Track continuous recording session
  const recordingSessionRef = useRef<{
    recordingId: string;
    meetingId: string;
    chunkIndex: number;
    totalChunks: number;
  } | null>(null);

  const startTimer = () => {
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const uploadChunk = async (blob: Blob, chunkIndex: number, meetingId: string) => {
    try {
      const formData = new FormData();
      formData.append('chunk', blob);
      formData.append('meetingId', meetingId);
      formData.append('chunkIndex', chunkIndex.toString());

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/recording/upload-chunk`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Failed to upload chunk');
      }
    } catch (err) {
      console.error('Upload chunk error:', err);
    }
  };

  const startRecording = async (audioTracks: MediaStreamTrack[] = []) => {
    try {
      setError(null);
      
      // Request screen capture (display media) - ONLY video
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 15,
        },
        audio: false // We capture all audio from LiveKit tracks directly
      });

      streamRef.current = stream;

      // Mix all provided audio tracks using Web Audio API
      if (audioTracks.length > 0) {
        try {
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          const destination = audioContext.createMediaStreamDestination();

          // Connect every provided track to the destination
          audioTracks.forEach(track => {
            if (track.readyState === 'live') {
              const source = audioContext.createMediaStreamSource(new MediaStream([track]));
              source.connect(destination);
            }
          });

          // Add the mixed audio track to the main recording stream
          const mixedTracks = destination.stream.getAudioTracks();
          if (mixedTracks.length > 0) {
            stream.addTrack(mixedTracks[0]);
          }
        } catch (e) {
          console.warn("Could not mix audio tracks, proceeding without mixed audio", e);
        }
      }

      // Initialize recording session on backend
      const initRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/recording/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: roomName, createdBy: userName })
      });
      
      if (!initRes.ok) throw new Error('Failed to start recording session');
      
      const { recordingId, meetingId } = await initRes.json();
      
      recordingSessionRef.current = {
        recordingId,
        meetingId,
        chunkIndex: 0,
        totalChunks: 0
      };

      const options = { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 500000 };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && recordingSessionRef.current) {
          const currentIndex = recordingSessionRef.current.chunkIndex;
          recordingSessionRef.current.chunkIndex++;
          recordingSessionRef.current.totalChunks++;
          
          await uploadChunk(event.data, currentIndex, recordingSessionRef.current.meetingId);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        stopTimer();
        setIsUploading(true);
        
        // Stop all tracks in the recording stream
        stream.getTracks().forEach(track => track.stop());
        
        // Close AudioContext
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(console.error);
          audioContextRef.current = null;
        }

        // Notify backend that recording is finished
        if (recordingSessionRef.current) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/recording/finish`, {
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
            onSuccess?.('Recording processing started on server');
          } catch (err) {
            console.error('Failed to finish recording:', err);
            onError?.('Failed to finalize recording');
          }
        }
        
        setIsUploading(false);
        recordingSessionRef.current = null;
      };

      // Output chunks every 5 seconds (5000ms)
      mediaRecorder.start(5000);
      setIsRecording(true);
      startTimer();

      // Handle user stopping the share via browser UI
      if (stream.getVideoTracks()[0]) {
        stream.getVideoTracks()[0].onended = () => {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        };
      }

    } catch (err: any) {
      console.error("Error starting recording:", err);
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Permission denied. Please allow screen sharing to record.' 
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
