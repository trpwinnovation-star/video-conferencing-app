'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Users, Share2, Play, MoreVertical, Loader } from 'lucide-react';
import { apiGetUserMeetings, apiJoinScheduledMeeting, ScheduledMeeting } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ScheduledMeetingsListProps {
  refresh?: boolean;
}

export default function ScheduledMeetingsList({ refresh }: ScheduledMeetingsListProps) {
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();

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
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleJoinMeeting = async (meeting: ScheduledMeeting) => {
    try {
      const result = await apiJoinScheduledMeeting(meeting.id);
      sessionStorage.setItem(`room_token_${result.roomId}`, result.token);
      const hostName = encodeURIComponent(meeting.host?.name || 'Host');
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
    const meetingEnd = new Date(
      meetingStart.getTime() + meeting.durationMinutes * 60000
    );
    const isStatusValid = meeting.status === 'scheduled' || meeting.status === 'in_progress';
    const isTimeValid = now >= new Date(meetingStart.getTime() - 15 * 60000) && now <= meetingEnd;
    return isStatusValid && isTimeValid;
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

                {/* Meeting Code */}
                <div className="bg-gray-50 p-3 rounded-lg mb-4">
                  <p className="text-xs text-gray-600 mb-1">Meeting Code</p>
                  <p className="font-mono font-bold text-gray-900">{meeting.meetingCode}</p>
                </div>
              </div>

              {/* Dropdown Menu */}
              <div className="ml-4">
                <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
              {/* Copy Link Button */}
              <button
                onClick={() => handleCopyLink(meeting.shareableLink, meeting.id)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
              >
                <Share2 size={16} />
                {copiedId === meeting.id ? 'Copied!' : 'Copy Link'}
              </button>

              {/* Join Button (only if meeting is happening now) */}
              {canJoinMeeting(meeting) && (
                <button
                  onClick={() => handleJoinMeeting(meeting)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <Play size={16} />
                  Join Now
                </button>
              )}

              {/* Future Join Button (if upcoming) */}
              {isFuture && !canJoinMeeting(meeting) && (
                <button
                  disabled
                  className="flex-1 bg-gray-300 text-gray-600 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Clock size={16} />
                  Starts {new Date(meeting.scheduledTime).toLocaleDateString()}
                </button>
              )}

              {/* View Details Button (if past) */}
              {isPast && meeting.status !== 'in_progress' && (
                <Link
                  href={`/meetings/${meeting.id}`}
                  className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-900 font-medium py-2 px-4 rounded-lg flex items-center justify-center transition"
                >
                  View Details
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
