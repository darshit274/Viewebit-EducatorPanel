import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronRight, Folder, FileText, Home, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { pdfHierarchyService, PdfCategoryNode, PdfItem, PdfCategoryContent } from '../../services/pdfHierarchy';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentUuid: string | null;
}

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ isOpen, onClose, onSuccess, parentUuid }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);
    try {
      if (parentUuid) {
        await pdfHierarchyService.createSubcategory(parentUuid, name, description || undefined);
      } else {
        await pdfHierarchyService.createRootCategory(name, description || undefined);
      }
      toast.success('Folder created');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">{parentUuid ? 'Add Subfolder' : 'New Folder'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Organic Chemistry Notes"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categoryUuid: string;
}

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onSuccess, categoryUuid }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setFile(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !file) {
      toast.error('Title and a PDF file are required');
      return;
    }
    setLoading(true);
    try {
      await pdfHierarchyService.uploadPdf(categoryUuid, title, file, description || undefined);
      toast.success('PDF uploaded');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload PDF');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Upload PDF</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">PDF File *</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-700"
              required
            />
          </div>
          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const PdfLibraryPage: React.FC = () => {
  const [rootCategories, setRootCategories] = useState<PdfCategoryNode[]>([]);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [content, setContent] = useState<PdfCategoryContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: 'category' | 'pdf'; uuid: string; label: string; loading: boolean }>({
    isOpen: false, type: 'category', uuid: '', label: '', loading: false,
  });

  const loadRoots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pdfHierarchyService.getRootCategories();
      setRootCategories(res.data || []);
    } catch (error) {
      toast.error('Failed to load PDF folders');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContent = useCallback(async (uuid: string) => {
    setLoading(true);
    try {
      const res = await pdfHierarchyService.getCategoryContent(uuid);
      setContent(res.data);
    } catch (error) {
      toast.error('Failed to load folder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUuid) loadContent(currentUuid);
    else loadRoots();
  }, [currentUuid, loadContent, loadRoots]);

  const refresh = () => {
    if (currentUuid) loadContent(currentUuid);
    else loadRoots();
  };

  const handleConfirmDelete = async () => {
    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      if (confirmModal.type === 'category') {
        await pdfHierarchyService.deleteCategory(confirmModal.uuid);
      } else {
        await pdfHierarchyService.deletePdf(confirmModal.uuid);
      }
      toast.success('Deleted successfully');
      refresh();
      setConfirmModal({ isOpen: false, type: 'category', uuid: '', label: '', loading: false });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete');
      setConfirmModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const nodeType = content?.category.node_type;
  const canAddSubcategory = !currentUuid || nodeType === 'unset' || nodeType === 'container';
  const canUpload = currentUuid && (nodeType === 'unset' || nodeType === 'pdf_holder');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PDF Library</h1>
          <p className="text-gray-600">Upload your own notes and study materials — link them to document lessons in your courses</p>
        </div>
        <div className="flex gap-2">
          {canAddSubcategory && (
            <button onClick={() => setShowCategoryModal(true)} className="btn-primary inline-flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              {currentUuid ? 'Add Subfolder' : 'New Folder'}
            </button>
          )}
          {canUpload && (
            <button onClick={() => setShowUploadModal(true)} className="btn-secondary inline-flex items-center">
              <Upload className="h-4 w-4 mr-2" />
              Upload PDF
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => setCurrentUuid(null)} className="flex items-center gap-1 hover:text-primary-600">
          <Home className="h-4 w-4" /> Root
        </button>
        {content?.category.parentCategory && (
          <>
            <ChevronRight className="h-4 w-4" />
            <button onClick={() => setCurrentUuid(content.category.parentCategory!.uuid)} className="hover:text-primary-600">
              {content.category.parentCategory.name}
            </button>
          </>
        )}
        {content && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-900 font-medium">{content.category.name}</span>
          </>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : !currentUuid ? (
          rootCategories.length === 0 ? (
            <div className="p-12 text-center">
              <Folder className="h-24 w-24 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No folders yet</h3>
              <button onClick={() => setShowCategoryModal(true)} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                New Folder
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {rootCategories.map((cat) => (
                <div key={cat.uuid} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <button onClick={() => setCurrentUuid(cat.uuid)} className="flex-1 text-left flex items-center gap-2">
                    <Folder className="h-5 w-5 text-primary-500" />
                    <span className="font-medium text-gray-900">{cat.name}</span>
                  </button>
                  <button onClick={() => setConfirmModal({ isOpen: true, type: 'category', uuid: cat.uuid, label: cat.name, loading: false })} className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {content && content.category.childCategories.length === 0 && content.category.pdfs.length === 0 && (
              <div className="p-12 text-center text-gray-500">This folder is empty — add a subfolder or upload a PDF above.</div>
            )}
            {content && content.category.childCategories.length > 0 && (
              <div className="divide-y divide-gray-200">
                {content.category.childCategories.map((cat) => (
                  <div key={cat.uuid} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <button onClick={() => setCurrentUuid(cat.uuid)} className="flex-1 text-left flex items-center gap-2">
                      <Folder className="h-5 w-5 text-primary-500" />
                      <span className="font-medium text-gray-900">{cat.name}</span>
                    </button>
                    <button onClick={() => setConfirmModal({ isOpen: true, type: 'category', uuid: cat.uuid, label: cat.name, loading: false })} className="p-2 text-gray-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {content && content.category.pdfs.length > 0 && (
              <div className="divide-y divide-gray-200">
                {content.category.pdfs.map((pdf: PdfItem) => (
                  <div key={pdf.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-2 flex-1">
                      <FileText className="h-5 w-5 text-primary-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{pdf.title}</p>
                        <p className="text-xs text-gray-500">{(pdf.file_size / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                    <button onClick={() => setConfirmModal({ isOpen: true, type: 'pdf', uuid: pdf.id, label: pdf.title, loading: false })} className="p-2 text-gray-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <AddCategoryModal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSuccess={refresh} parentUuid={currentUuid} />
      {currentUuid && (
        <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} onSuccess={refresh} categoryUuid={currentUuid} />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: 'category', uuid: '', label: '', loading: false })}
        onConfirm={handleConfirmDelete}
        title={`Delete ${confirmModal.type === 'category' ? 'Folder' : 'PDF'}`}
        message={`Are you sure you want to delete "${confirmModal.label}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={confirmModal.loading}
      />
    </div>
  );
};
