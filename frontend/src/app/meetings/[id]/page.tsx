'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGetScheduledMeetingDetails, ScheduledMeeting } from '@/lib/api';
import { Calendar, Clock, Users, ArrowLeft, Loader, Copy, Check } from 'lucide-react';
import Link from 'next/link';

export default function MeetingDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [meeting, setMeeting] = useState<ScheduledMeeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const data = await apiGetScheduledMeetingDetails(id);
        setMeeting(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch meeting details');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeeting();
  }, [id]);

  const handleCopyLink = () => {
    if (meeting?.shareableLink) {
      navigator.clipboard.writeText(meeting.shareableLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            {error || 'Meeting not found'}
          </div>
          <button 
            onClick={() => router.back()} 
            className="mt-4 flex items-center text-blue-600 hover:underline font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold uppercase">In Progress</span>;
      case 'completed':
        return <span className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-xs font-semibold uppercase">Completed</span>;
      case 'cancelled':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold uppercase">Cancelled</span>;
      default:
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold uppercase">Scheduled</span>;
    }
  };

  const meetingTime = new Date(meeting.scheduledTime);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 font-medium transition"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Link>

        <div className="bg-white shadow rounded-xl overflow-hidden">
          <div className="px-6 py-8 border-b border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{meeting.title}</h1>
              {getStatusBadge(meeting.status)}
            </div>
            
            {meeting.description && (
              <p className="text-gray-600 mt-2">{meeting.description}</p>
            )}

            <div className="mt-6 flex flex-wrap gap-6 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-gray-400" />
                {meetingTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="flex items-center">
                <Clock className="w-5 h-5 mr-2 text-gray-400" />
                {meetingTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} 
                <span className="ml-1">({meeting.durationMinutes} min)</span>
              </div>
              <div className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-gray-400" />
                Host: {meeting.host?.name}
              </div>
            </div>
          </div>

          <div className="px-6 py-6 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Join Information</h3>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Shareable Link</p>
                <a href={meeting.shareableLink} className="text-blue-600 break-all text-sm hover:underline">
                  {meeting.shareableLink}
                </a>
              </div>
              <button
                onClick={handleCopyLink}
                className="flex-shrink-0 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-medium transition text-sm"
              >
                {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy Link</>}
              </button>
            </div>
            <div className="mt-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
               <p className="text-sm font-medium text-gray-500 mb-1">Meeting Code</p>
               <p className="font-mono text-gray-900 font-bold">{meeting.meetingCode}</p>
            </div>
          </div>

          {meeting.attendees && meeting.attendees.length > 0 && (
            <div className="px-6 py-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendees ({meeting.attendees.length})</h3>
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {meeting.attendees.map((attendee: any) => (
                  <li key={attendee.id} className="p-4 bg-white hover:bg-gray-50 transition">
                    <p className="text-sm font-medium text-gray-900">{attendee.name || attendee.email}</p>
                    {attendee.name && <p className="text-xs text-gray-500">{attendee.email}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
