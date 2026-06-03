'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGetMeetingByCode } from '@/lib/api';
import { Clock, Calendar, Play, Loader, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ScheduledMeetingJoinPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();

  const [meeting, setMeeting] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const data = await apiGetMeetingByCode(roomId);
        setMeeting(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Meeting not found');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeeting();
  }, [roomId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Meeting Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const isCompleted = meeting.status === 'completed' || meeting.status === 'cancelled';
  const meetingTime = new Date(meeting.scheduledTime);
  const now = new Date();
  
  // Allow joining if within 15 minutes of start time or if it's already started
  const canJoin = meeting.status === 'in_progress' || (meeting.status === 'scheduled' && now >= new Date(meetingTime.getTime() - 15 * 60000));

  if (isCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Meeting Ended</h1>
          <p className="text-gray-600 mb-6">This meeting has already ended and the link is no longer active.</p>
          <Link href="/" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{meeting.title}</h1>
          <p className="text-gray-500">Hosted by {meeting.host?.name}</p>
        </div>

        {meeting.description && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
            {meeting.description}
          </div>
        )}

        <div className="flex items-center justify-center gap-6 mb-8 text-gray-600">
          <div className="flex flex-col items-center">
            <Calendar className="w-6 h-6 mb-1 text-blue-500" />
            <span className="font-medium text-sm">
              {meetingTime.toLocaleDateString()}
            </span>
          </div>
          <div className="w-px h-8 bg-gray-200"></div>
          <div className="flex flex-col items-center">
            <Clock className="w-6 h-6 mb-1 text-blue-500" />
            <span className="font-medium text-sm">
              {meetingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {canJoin ? (
          <div className="text-center">
            <p className="text-green-600 font-medium mb-4">The meeting is ready to join!</p>
            <Link 
              href={`/room/${roomId}`} 
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition"
            >
              <Play className="w-5 h-5" />
              Join Meeting
            </Link>
          </div>
        ) : (
          <div className="text-center bg-blue-50 p-6 rounded-lg border border-blue-100">
            <p className="text-blue-800 font-medium mb-2">Meeting hasn't started yet</p>
            <p className="text-sm text-blue-600">
              You can join this meeting 15 minutes before the scheduled start time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
