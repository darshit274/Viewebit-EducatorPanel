import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesService } from '../../services/courses';
import { CourseCategoryOption } from '../../types';

interface CourseCategoryPickerProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export const CourseCategoryPicker: React.FC<CourseCategoryPickerProps> = ({ selectedIds, onChange }) => {
  const [categories, setCategories] = useState<CourseCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadCategories = async () => {
    try {
      const res = await coursesService.getCourseCategories();
      setCategories(res.data || []);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const toggle = (id: number) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((c) => c !== id) : [...selectedIds, id]);
  };

  const handleAddCategory = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await coursesService.createCourseCategory(newName.trim());
      setCategories((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      onChange([...selectedIds, res.data.id]);
      setNewName('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create category');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
      <div className="border border-gray-300 rounded-md max-h-40 overflow-y-auto divide-y divide-gray-100">
        {loading ? (
          <p className="text-sm text-gray-400 px-3 py-2">Loading categories...</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-400 px-3 py-2">No categories yet — add one below.</p>
        ) : (
          categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selectedIds.includes(cat.id)}
                onChange={() => toggle(cat.id)}
                className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              />
              {cat.name}
            </label>
          ))
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
          placeholder="New category name"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={handleAddCategory}
          disabled={creating || !newName.trim()}
          className="px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50 disabled:opacity-50 inline-flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
};
