import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronRight, Folder, HelpCircle, Home } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { quizHierarchyService, QuizCategory, QuizQuestion, CategoryContent } from '../../services/quizHierarchy';

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
        await quizHierarchyService.createSubcategory(parentUuid, name, description || undefined);
      } else {
        await quizHierarchyService.createRootCategory(name, description || undefined);
      }
      toast.success('Category created');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">{parentUuid ? 'Add Subcategory' : 'New Quiz Category'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Organic Chemistry — Reactions"
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

interface AddQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categoryUuid: string;
}

const AddQuestionModal: React.FC<AddQuestionModalProps> = ({ isOpen, onClose, onSuccess, categoryUuid }) => {
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState({ A: '', B: '', C: '', D: '' });
  const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [marks, setMarks] = useState('1');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuestionText('');
      setOptions({ A: '', B: '', C: '', D: '' });
      setCorrectAnswer('A');
      setExplanation('');
      setMarks('1');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !options.A.trim() || !options.B.trim() || !options.C.trim() || !options.D.trim()) {
      toast.error('Question text and all four options are required');
      return;
    }
    setLoading(true);
    try {
      await quizHierarchyService.createQuestion(categoryUuid, {
        question_text: questionText,
        option_a: options.A,
        option_b: options.B,
        option_c: options.C,
        option_d: options.D,
        correct_answer: correctAnswer,
        explanation: explanation || undefined,
        marks: parseInt(marks) || 1,
      });
      toast.success('Question added');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add question');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Add Question</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Question *</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          {(['A', 'B', 'C', 'D'] as const).map((key) => (
            <div key={key} className="flex items-center gap-3">
              <input
                type="radio"
                name="correct_answer"
                checked={correctAnswer === key}
                onChange={() => setCorrectAnswer(key)}
                className="h-4 w-4 text-primary-600"
              />
              <input
                type="text"
                value={options[key]}
                onChange={(e) => setOptions({ ...options, [key]: e.target.value })}
                placeholder={`Option ${key}`}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          ))}
          <p className="text-xs text-gray-500">Select the radio button next to the correct option.</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (optional)</label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Marks</label>
            <input
              type="number"
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Adding...' : 'Add Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const QuizCategoriesPage: React.FC = () => {
  const [rootCategories, setRootCategories] = useState<QuizCategory[]>([]);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [content, setContent] = useState<CategoryContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: 'category' | 'question'; uuid: string; label: string; loading: boolean }>({
    isOpen: false, type: 'category', uuid: '', label: '', loading: false,
  });

  const loadRoots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await quizHierarchyService.getRootCategories();
      setRootCategories(res.data || []);
    } catch (error) {
      toast.error('Failed to load quiz categories');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContent = useCallback(async (uuid: string) => {
    setLoading(true);
    try {
      const res = await quizHierarchyService.getCategoryContent(uuid);
      setContent(res.data);
    } catch (error) {
      toast.error('Failed to load category');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUuid) {
      loadContent(currentUuid);
    } else {
      loadRoots();
    }
  }, [currentUuid, loadContent, loadRoots]);

  const refresh = () => {
    if (currentUuid) loadContent(currentUuid);
    else loadRoots();
  };

  const handleConfirmDelete = async () => {
    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      if (confirmModal.type === 'category') {
        await quizHierarchyService.deleteCategory(confirmModal.uuid);
      } else {
        await quizHierarchyService.deleteQuestion(confirmModal.uuid);
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
  const canAddQuestion = currentUuid && (nodeType === 'unset' || nodeType === 'question_holder');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quiz Categories</h1>
          <p className="text-gray-600">Build your own question bank — link categories to quiz lessons and assignments in your courses</p>
        </div>
        <div className="flex gap-2">
          {canAddSubcategory && (
            <button onClick={() => setShowCategoryModal(true)} className="btn-primary inline-flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              {currentUuid ? 'Add Subcategory' : 'New Category'}
            </button>
          )}
          {canAddQuestion && (
            <button onClick={() => setShowQuestionModal(true)} className="btn-secondary inline-flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Add Question
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">No quiz categories yet</h3>
              <button onClick={() => setShowCategoryModal(true)} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                New Category
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {rootCategories.map((cat) => (
                <div key={cat.uuid} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <button onClick={() => setCurrentUuid(cat.uuid)} className="flex-1 text-left flex items-center gap-2">
                    <Folder className="h-5 w-5 text-primary-500" />
                    <span className="font-medium text-gray-900">{cat.name}</span>
                    <span className="text-xs text-gray-400 capitalize">({cat.node_type.replace('_', ' ')})</span>
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
            {content && content.category.childCategories.length === 0 && content.category.questions.length === 0 && (
              <div className="p-12 text-center text-gray-500">This category is empty — add a subcategory or a question above.</div>
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
            {content && content.category.questions.length > 0 && (
              <div className="divide-y divide-gray-200">
                {content.category.questions.map((q: QuizQuestion) => (
                  <div key={q.uuid} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-start gap-2 flex-1">
                      <HelpCircle className="h-5 w-5 text-primary-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{q.question_text}</p>
                        <p className="text-xs text-gray-500">Correct: {q.correct_answer} · {q.marks} mark{q.marks === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    <button onClick={() => setConfirmModal({ isOpen: true, type: 'question', uuid: q.uuid, label: q.question_text, loading: false })} className="p-2 text-gray-400 hover:text-red-600">
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
        <AddQuestionModal isOpen={showQuestionModal} onClose={() => setShowQuestionModal(false)} onSuccess={refresh} categoryUuid={currentUuid} />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: 'category', uuid: '', label: '', loading: false })}
        onConfirm={handleConfirmDelete}
        title={`Delete ${confirmModal.type === 'category' ? 'Category' : 'Question'}`}
        message={`Are you sure you want to delete "${confirmModal.label}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={confirmModal.loading}
      />
    </div>
  );
};
