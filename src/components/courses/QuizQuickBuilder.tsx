// src/components/courses/QuizQuickBuilder.tsx
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { coursesService } from '../../services/courses';
import { quizHierarchyService } from '../../services/quizHierarchy';
import { QuizCategoryOption } from '../../types';
import { QuestionFieldsForm, QuestionFieldsValue, emptyQuestionFields } from '../quizzes/QuestionFieldsForm';

interface QuizQuickBuilderProps {
  courseUuid: string;
  onCreated: (category: QuizCategoryOption) => void;
}

type ImportPreview = { totalRows: number; validQuestions: any[]; errors: any[] } | null;

export const QuizQuickBuilder: React.FC<QuizQuickBuilderProps> = ({ courseUuid, onCreated }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<QuizCategoryOption | null>(null);
  const [creating, setCreating] = useState(false);
  // Guards against onCreated firing more than once for a single mount — it's meant to
  // be reported to the parent exactly once, the first time the quiz becomes usable
  // (i.e. has at least one question), not on every subsequent question add.
  const reportedRef = useRef(false);

  const [mode, setMode] = useState<'manual' | 'import'>('manual');
  const [fields, setFields] = useState<QuestionFieldsValue>(emptyQuestionFields());
  const [addedCount, setAddedCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState<'excel' | 'csv' | null>(null);

  const handleCreateCategory = async () => {
    if (!name.trim()) {
      toast.error('Quiz name is required');
      return;
    }
    setCreating(true);
    try {
      const res = await coursesService.createCourseQuizCategory(courseUuid, name);
      // Intentionally NOT calling onCreated here: the parent should only learn about
      // this category once it's actually usable, i.e. once it has ≥1 question (see
      // handleAddQuestion / handleConfirmImport below). An empty category shouldn't be
      // selectable/saveable by the parent lesson form.
      setCategory(res.data);
      toast.success('Quiz created — now add questions below');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create quiz');
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadTemplate = async (format: 'excel' | 'csv') => {
    setDownloadingTemplate(format);
    try {
      await quizHierarchyService.downloadImportTemplate(format);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to download template');
    } finally {
      setDownloadingTemplate(null);
    }
  };

  const handleAddQuestion = async () => {
    if (!category) return;
    if (!fields.questionText.trim() || !fields.options.A.trim() || !fields.options.B.trim() || !fields.options.C.trim() || !fields.options.D.trim()) {
      toast.error('Question text and all four options are required');
      return;
    }
    setSaving(true);
    try {
      await quizHierarchyService.bulkCreateQuestions(category.uuid, [{
        question_text: fields.questionText,
        option_a: fields.options.A,
        option_b: fields.options.B,
        option_c: fields.options.C,
        option_d: fields.options.D,
        correct_answer: fields.correctAnswer,
        explanation: fields.explanation || undefined,
        marks: parseInt(fields.marks) || 1,
      }]);
      const wasEmpty = addedCount === 0;
      setAddedCount((n) => n + 1);
      setFields(emptyQuestionFields());
      toast.success('Question added');
      if (wasEmpty && !reportedRef.current) {
        reportedRef.current = true;
        onCreated(category);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add question');
    } finally {
      setSaving(false);
    }
  };

  const handleParseImport = async () => {
    if (!importFile) {
      toast.error('Choose a file first');
      return;
    }
    setParsing(true);
    try {
      const res = await quizHierarchyService.parseImportFile(importFile);
      setImportPreview(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!category || !importPreview || importPreview.validQuestions.length === 0) return;
    setConfirming(true);
    try {
      const res = await quizHierarchyService.bulkCreateQuestions(category.uuid, importPreview.validQuestions);
      const wasEmpty = addedCount === 0;
      setAddedCount((n) => n + res.data.created);
      toast.success(`${res.data.created} questions imported`);
      setImportPreview(null);
      setImportFile(null);
      if (wasEmpty && res.data.created > 0 && !reportedRef.current) {
        reportedRef.current = true;
        onCreated(category);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to import questions');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-md p-3 space-y-3 bg-gray-50">
      {!category ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Quiz Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chapter 1 Quiz"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="button"
            onClick={handleCreateCategory}
            disabled={creating}
            className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Quiz'}
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-900">{category.name} — {addedCount} question{addedCount === 1 ? '' : 's'} added</p>

          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => setMode('manual')} className={`px-2 py-1 rounded ${mode === 'manual' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
              Add manually
            </button>
            <button type="button" onClick={() => setMode('import')} className={`px-2 py-1 rounded ${mode === 'import' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
              Import from Excel/CSV
            </button>
          </div>

          {mode === 'manual' && (
            <div className="space-y-3">
              <QuestionFieldsForm value={fields} onChange={setFields} idPrefix="quick_quiz" />
              <button
                type="button"
                onClick={handleAddQuestion}
                disabled={saving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Adding...' : '+ Add another question'}
              </button>
            </div>
          )}

          {mode === 'import' && (
            <div className="space-y-3">
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('excel')}
                  disabled={downloadingTemplate !== null}
                  className="text-primary-600 hover:underline disabled:opacity-50"
                >
                  {downloadingTemplate === 'excel' ? 'Downloading...' : 'Download Excel Template'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  disabled={downloadingTemplate !== null}
                  className="text-primary-600 hover:underline disabled:opacity-50"
                >
                  {downloadingTemplate === 'csv' ? 'Downloading...' : 'Download CSV Template'}
                </button>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportPreview(null); }}
                className="w-full text-sm text-gray-700"
              />
              <button
                type="button"
                onClick={handleParseImport}
                disabled={!importFile || parsing}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {parsing ? 'Validating...' : 'Upload & Validate'}
              </button>

              {importPreview && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-700">
                    {importPreview.validQuestions.length} valid, {importPreview.errors.length} error{importPreview.errors.length === 1 ? '' : 's'} out of {importPreview.totalRows} rows.
                  </p>
                  {importPreview.errors.length > 0 && (
                    <div className="max-h-24 overflow-y-auto text-xs text-red-600 space-y-0.5">
                      {importPreview.errors.slice(0, 10).map((e: any, i: number) => (
                        <p key={i}>Row {e.row}: {e.field} — {e.error}</p>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={importPreview.validQuestions.length === 0 || confirming}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {confirming ? 'Importing...' : `Confirm Import (${importPreview.validQuestions.length})`}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
