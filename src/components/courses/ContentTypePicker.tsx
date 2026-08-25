import React from 'react';
import { X, AlignLeft, Video, Radio, FileText, Headphones, HelpCircle, Users, Webcam, ClipboardList } from 'lucide-react';
import { MeetingProvider } from '../../services/liveSessions';

export type ContentCardKind = 'text' | 'video' | 'live_stream' | 'pdf' | 'audio' | 'quiz' | 'google_meet' | 'zoom_meeting' | 'assignment';

export interface ContentTypeSelection {
  lessonType: 'text' | 'video' | 'pdf' | 'audio' | 'quiz' | 'live' | 'assignment';
  /** Only set when lessonType === 'live' — which meeting card was chosen. */
  meetingProvider?: MeetingProvider;
}

const CARDS: { kind: ContentCardKind; label: string; icon: React.ElementType; selection: ContentTypeSelection }[] = [
  { kind: 'text', label: 'Text Lesson', icon: AlignLeft, selection: { lessonType: 'text' } },
  { kind: 'video', label: 'Video Lesson', icon: Video, selection: { lessonType: 'video' } },
  { kind: 'live_stream', label: 'Live Stream Lesson', icon: Radio, selection: { lessonType: 'live', meetingProvider: 'jitsi' } },
  { kind: 'pdf', label: 'PDF Lesson', icon: FileText, selection: { lessonType: 'pdf' } },
  { kind: 'audio', label: 'Audio Lesson', icon: Headphones, selection: { lessonType: 'audio' } },
  { kind: 'quiz', label: 'Quiz', icon: HelpCircle, selection: { lessonType: 'quiz' } },
  { kind: 'google_meet', label: 'Google Meet', icon: Users, selection: { lessonType: 'live', meetingProvider: 'google_meet' } },
  { kind: 'zoom_meeting', label: 'Zoom Meeting', icon: Webcam, selection: { lessonType: 'live', meetingProvider: 'zoom' } },
  { kind: 'assignment', label: 'Assignment', icon: ClipboardList, selection: { lessonType: 'assignment' } },
];

interface ContentTypePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: ContentTypeSelection) => void;
}

export const ContentTypePicker: React.FC<ContentTypePickerProps> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-gray-900">Select Your Content Type</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {CARDS.map(({ kind, label, icon: Icon, selection }) => (
            <button
              key={kind}
              type="button"
              onClick={() => onSelect(selection)}
              className="flex items-center gap-3 px-4 py-4 border border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors text-left"
            >
              <span className="flex-shrink-0 w-9 h-9 rounded-md bg-primary-50 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary-600" />
              </span>
              <span className="text-sm font-medium text-gray-900">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
