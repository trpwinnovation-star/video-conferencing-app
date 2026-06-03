'use client';

import React, { useState } from 'react';
import { Calendar, Clock, Users, Copy, Check, Loader } from 'lucide-react';
import { apiScheduleMeeting } from '@/lib/api';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingScheduled?: () => void;
}

export default function ScheduleMeetingModal({
  isOpen,
  onClose,
  onMeetingScheduled,
}: ScheduleMeetingModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [attendeeEmails, setAttendeeEmails] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [shareableLink, setShareableLink] = useState('');
  const [meetingCode, setMeetingCode] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!title.trim()) {
        throw new Error('Meeting title is required');
      }
      if (!date) {
        throw new Error('Date is required');
      }

      // Combine date and time
      const scheduledDateTime = new Date(`${date}T${time}`);
      const now = new Date();

      if (scheduledDateTime <= now) {
        throw new Error('Scheduled time must be in the future');
      }
      
      if (!password || password.length < 4) {
        throw new Error('Password is required and must be at least 4 characters');
      }

      // Parse attendee emails
      const emails = attendeeEmails
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      const result = await apiScheduleMeeting(
        title,
        description || undefined,
        scheduledDateTime,
        durationMinutes,
        emails,
        password
      );

      setShareableLink(result.shareableLink);
      setMeetingCode(result.meetingCode);
      onMeetingScheduled?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule meeting');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If meeting created, show success screen
  if (shareableLink) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-8 shadow-xl">
          <h2 className="text-2xl font-bold mb-4 text-green-600">Meeting Scheduled!</h2>

          <div className="mb-6 space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Meeting Code</p>
              <p className="text-xl font-mono font-bold text-gray-900">{meetingCode}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Share Link</p>
              <p className="text-sm break-all text-blue-600">{shareableLink}</p>
            </div>
          </div>

          <button
            onClick={handleCopyLink}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg mb-3 flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check size={18} /> Copied!
              </>
            ) : (
              <>
                <Copy size={18} /> Copy Link
              </>
            )}
          </button>

          <button
            onClick={() => {
              setShareableLink('');
              setMeetingCode('');
              setTitle('');
              setDescription('');
              setDate('');
              setTime('10:00');
              setDurationMinutes(60);
              setAttendeeEmails('');
              setPassword('');
              onClose();
            }}
            className="w-full bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold py-2 px-4 rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-8 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-3xl font-bold mb-6 text-gray-900">Schedule a Meeting</h2>

        <form onSubmit={handleScheduleMeeting} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Team Standup"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add an optional description..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} /> Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock size={16} /> Time *
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
            </select>
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Users size={16} /> Invite Attendees
            </label>
            <textarea
              value={attendeeEmails}
              onChange={(e) => setAttendeeEmails(e.target.value)}
              placeholder="Enter email addresses separated by commas (optional)"
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">example@email.com, another@email.com</p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Password *
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a secure password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition"
            >
              {isLoading ? (
                <>
                  <Loader size={18} className="animate-spin" /> Scheduling...
                </>
              ) : (
                'Schedule Meeting'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-900 font-semibold py-3 px-4 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
