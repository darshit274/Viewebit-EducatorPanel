import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { coursesService } from '../../services/courses';

interface PdfQuickUploadProps {
  courseUuid: string;
  onUploaded: (pdf: { id: string; title: string }) => void;
}

export const PdfQuickUpload: React.FC<PdfQuickUploadProps> = ({ courseUuid, onUploaded }) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!title.trim() || !file) {
      toast.error('Title and a PDF file are required');
      return;
    }
    setUploading(true);
    try {
      const res = await coursesService.uploadCoursePdf(courseUuid, title, file);
      toast.success('PDF uploaded');
      onUploaded(res.data);
      setTitle('');
      setFile(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-md p-3 space-y-3 bg-gray-50">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">PDF File *</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-700"
        />
      </div>
      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading}
        className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : 'Upload PDF'}
      </button>
    </div>
  );
};
