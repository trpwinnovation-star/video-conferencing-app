'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Users, Share2, Play, MoreVertical, Loader } from 'lucide-react';
import { apiGetUserMeetings, apiJoinScheduledMeeting, ScheduledMeeting } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

interface ScheduledMeetingsListProps {
  refresh?: boolean;
}

export default function ScheduledMeetingsList({ refresh }: ScheduledMeetingsListProps) {
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    loadMeetings();
  }, [refresh]);

  const loadMeetings = async () => {
    try {
      setIsLoading(true);
      const result = await apiGetUserMeetings();
      setMeetings(result.meetings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = (link: string, id: string) => {
    let finalLink = link;
    if (typeof window !== 'undefined') {
      const currentOrigin = window.location.origin;
      if (link.includes('localhost:3000') && !currentOrigin.includes('localhost')) {
        finalLink = link.replace('http://localhost:3000', currentOrigin);
      }
    }
    navigator.clipboard.writeText(finalLink);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleJoinMeeting = async (meeting: ScheduledMeeting) => {
    try {
      const result = await apiJoinScheduledMeeting(meeting.id);
      sessionStorage.setItem(`room_token_${result.roomId}`, result.token);
      const hostName = encodeURIComponent(user?.name || meeting.host?.name || 'Host');
      router.push(`/room/${result.roomId}?name=${hostName}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to join meeting');
    }
  };

  const getStatusColor = (meeting: ScheduledMeeting) => {
    const now = new Date();
    const meetingStart = new Date(meeting.scheduledTime);
    const hoursUntil = (meetingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    switch (meeting.status) {
      case 'in_progress':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'scheduled':
        if (hoursUntil <= 1) return 'bg-orange-100 text-orange-800';
        if (hoursUntil <= 24) return 'bg-yellow-100 text-yellow-800';
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canJoinMeeting = (meeting: ScheduledMeeting) => {
    const now = new Date();
    const meetingStart = new Date(meeting.scheduledTime);
    const meetingEnd = new Date(meetingStart.getTime() + meeting.durationMinutes * 60000);
    const isStatusValid = meeting.status === 'scheduled' || meeting.status === 'in_progress';
    const isTimeValid = now >= new Date(meetingStart.getTime() - 15 * 60000);
    const isNotExpired = meeting.status === 'in_progress' || now < meetingEnd;
    return isStatusValid && isTimeValid && isNotExpired;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
        {error}
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No meetings scheduled</h3>
        <p className="text-gray-600">Create your first meeting to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {meetings.map((meeting) => {
        const isFuture = new Date(meeting.scheduledTime) > new Date();
        const isPast = new Date(meeting.scheduledTime) < new Date();

        return (
          <div
            key={meeting.id}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-gray-900">{meeting.title}</h3>
                  <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(meeting)}`}>
                    {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                  </span>
                </div>

                {meeting.description && (
                  <p className="text-gray-600 text-sm mb-3">{meeting.description}</p>
                )}

                <div className="flex items-center flex-wrap gap-4 text-sm text-gray-600 mb-3">
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    {formatDateTime(meeting.scheduledTime)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{meeting.durationMinutes} minutes</span>
                  </div>
                  {meeting.attendees && meeting.attendees.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Users size={16} />
                      {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Meeting details end */}
              </div>

              {/* Dropdown Menu */}
              <div className="ml-4">
                {/* <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                  <MoreVertical size={20} />
                </button> */}
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-stone-100">
              {/* Left Side: Code block with Copy action */}
              <div className="flex items-center justify-between bg-stone-50 border border-stone-200/80 rounded-xl px-4 py-2 w-full sm:w-auto sm:min-w-[240px]">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Meeting Code</span>
                  <span className="font-mono text-sm font-bold text-stone-900">{meeting.meetingCode}</span>
                </div>
                <button
                  onClick={() => handleCopyLink(meeting.shareableLink, meeting.id)}
                  className="p-1.5 px-3 bg-white hover:bg-stone-100 text-stone-700 hover:text-stone-900 border border-stone-200 rounded-lg shadow-sm flex items-center justify-center transition-all cursor-pointer text-xs font-semibold gap-1.5"
                  title="Copy meeting link"
                >
                  <Share2 size={13} />
                  <span>{copiedId === meeting.id ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {/* Right Side: Primary Action Button */}
              <div className="flex justify-end gap-2">
                {/* Edit Button for Host */}
                {meeting.hostId === user?.id && meeting.status !== 'completed' && meeting.status !== 'cancelled' && (
                  <Link
                    href={`/meetings/${meeting.id}/edit`}
                    className="bg-stone-50 hover:bg-stone-100 text-stone-700 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center transition-all text-sm border border-stone-200"
                  >
                    Edit
                  </Link>
                )}

                {/* Join Button */}
                {canJoinMeeting(meeting) && (
                  <button
                    onClick={() => handleJoinMeeting(meeting)}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer text-sm"
                  >
                    <Play size={15} />
                    <span>Join Now</span>
                  </button>
                )}

                {/* Future Starts */}
                {isFuture && !canJoinMeeting(meeting) && (
                  <button
                    disabled
                    className="bg-stone-100 text-stone-500 border border-stone-200 font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed text-sm"
                  >
                    <Clock size={14} />
                    <span>Starts {new Date(meeting.scheduledTime).toLocaleDateString()}</span>
                  </button>
                )}

                {/* View Details */}
                {isPast && meeting.status !== 'in_progress' && (
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className="bg-[#c16d18]/10 hover:bg-[#c16d18]/20 text-[#c16d18] font-bold py-2.5 px-6 rounded-xl flex items-center justify-center transition-all text-sm border border-[#c16d18]/20"
                  >
                    View Details
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
