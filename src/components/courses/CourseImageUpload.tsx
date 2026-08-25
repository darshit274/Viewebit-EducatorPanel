import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesService } from '../../services/courses';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/gif,image/webp';

interface CourseImageUploadProps {
  /** When set, a selected file is uploaded immediately (edit mode). */
  courseUuid?: string;
  /** Existing/previewed image URL. */
  value: string | null;
  /** Fired once an immediate upload succeeds, or a file is picked in deferred mode. */
  onChange: (url: string | null) => void;
  /** Deferred mode (no courseUuid yet, e.g. inside Create Course): hand the raw File up so the parent can upload it after the course is created. */
  onFileSelected?: (file: File | null) => void;
}

export const CourseImageUpload: React.FC<CourseImageUploadProps> = ({ courseUuid, value, onChange, onFileSelected }) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!courseUuid) {
      onChange(URL.createObjectURL(file));
      onFileSelected?.(file);
      return;
    }
    setUploading(true);
    try {
      const res = await coursesService.uploadThumbnail(courseUuid, file);
      onChange(res.data.thumbnail_url);
      toast.success('Featured image updated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleRemove = () => {
    onChange(null);
    onFileSelected?.(null);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Featured Image</label>
      <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={handleInputChange} />
      {value ? (
        <div className="relative w-full h-40 rounded-md overflow-hidden border border-gray-300 group">
          <img src={value} alt="Course featured" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="p-2 bg-white rounded-full text-gray-700 hover:text-primary-600"
              title="Replace image"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="p-2 bg-white rounded-full text-gray-700 hover:text-red-600"
              title="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-40 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50"
        >
          <ImageIcon className="h-8 w-8" />
          <span className="text-sm font-medium">{uploading ? 'Uploading...' : 'Click to upload an image'}</span>
          <span className="text-xs text-gray-400">JPG, PNG, GIF, or WebP — max 2MB</span>
        </button>
      )}
    </div>
  );
};
