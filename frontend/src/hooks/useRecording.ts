import { useState, useRef, useCallback, useEffect } from 'react';
import { uploadRecording } from '@/lib/api';

interface UseRecordingOptions {
  roomName: string;
  onSuccess?: (filePath: string) => void;
  onError?: (error: string) => void;
}

export function useRecording({ roomName, onSuccess, onError }: UseRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const startRecording = async () => {
    try {
      setError(null);
      
      // Request screen capture (display media)
      // videoBitsPerSecond: 500000, frameRate: 15 requested by user
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 15,
        },
        audio: true // Important for capturing tab audio
      });

      streamRef.current = stream;

      // Check if user has microphone and add it to the stream if possible
      // to record both system audio and user voice
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        // Add display audio
        if (stream.getAudioTracks().length > 0) {
          const displaySource = audioContext.createMediaStreamSource(new MediaStream([stream.getAudioTracks()[0]]));
          displaySource.connect(destination);
        }

        // Add mic audio
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);

        // Replace stream audio tracks with mixed audio
        const mixedTracks = destination.stream.getAudioTracks();
        if (mixedTracks.length > 0) {
          // Remove old audio tracks
          stream.getAudioTracks().forEach(track => stream.removeTrack(track));
          // Add new mixed track
          stream.addTrack(mixedTracks[0]);
        }
      } catch (e) {
        console.warn("Could not merge microphone audio, recording only tab audio", e);
      }

      const options = { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 500000 };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        stopTimer();
        
        // Stop all tracks in the stream
        stream.getTracks().forEach(track => track.stop());
        
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const fileName = `recording-${roomName}-${new Date().toISOString().replace(/:/g, '-')}.webm`;
        
        await handleUpload(blob, fileName);
      };

      mediaRecorder.start();
      setIsRecording(true);
      startTimer();

      // Handle user stopping the share via browser UI
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      };

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

  const handleUpload = async (blob: Blob, fileName: string) => {
    setIsUploading(true);
    try {
      const result = await uploadRecording(blob, fileName);
      onSuccess?.(result.filePath);
    } catch (err: any) {
      console.error("Upload failed:", err);
      const errorMessage = err.message || 'Failed to upload recording';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      stopTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
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
