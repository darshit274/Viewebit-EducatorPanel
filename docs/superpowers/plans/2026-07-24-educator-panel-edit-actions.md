# Educator Panel Edit/Delete/View Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing edit (and for PDFs, view) actions across 4 Educator Panel screens — PDFs, Quiz Categories, My Courses (+ Course Builder modules/lessons), and Assignments — plus add course-level delete, which doesn't exist at all today.

**Architecture:** For 6 of 8 entities, the backend `PUT` update endpoint already exists and works — the gap is entirely frontend (missing service wrapper + missing edit UI). One entity (quiz category) already has both the backend endpoint and the frontend service call, just no UI. One new backend capability is added: `DELETE /educator/courses/:uuid`, gated the same way quiz-category/PDF-category delete already gate on non-empty content (blocked if the course's linked `test_series_id` has any `completed` `Subscription`). A small backend addition also computes a `file_url` for each PDF in `getCategoryContent`'s response, since PDFs are stored as an absolute disk path (`file_path`) that isn't directly usable as a link — the app already serves `uploads/` statically at `/uploads` (`index.js:83`), so this is a URL computation, not new storage.

**Tech Stack:** Node/Express 5 + Sequelize 6 + MySQL (`Viewebit-backend`); React 19 + TypeScript + Tailwind + axios (`Viewebit-EducatorPanel`). No automated test framework exists in either repo. Verification is `node -e` require-checks + curl for the backend, `npx tsc --noEmit` + `npm run build` for the frontend, and a manual click-through of every new action once a dev server is running.

## Global Constraints

- Edit modals expose only the fields already collected on that entity's corresponding create form — no new fields introduced (e.g. no `is_active` toggles, no quiz-category timing/negative-marking settings, no assignment `description`/`allow_late_submission`, no course `thumbnail_url`/`completion_threshold_percent` — all explicitly out of scope for this pass).
- Every new Edit button uses the `Pencil` icon from `lucide-react`, placed immediately to the left of the existing Delete (`Trash2`) icon, matching that icon's exact button styling (`className="p-2 text-gray-400 hover:text-red-600"` for page-level rows, `className="p-1 text-gray-400 hover:text-red-600"` for the smaller Course Builder rows) but with a neutral hover color (`hover:text-primary-600`) instead of the red used for delete.
- Every edit modal follows the exact create-modal structural pattern already established in its own file (same overlay/card classes, same `useEffect`-on-`isOpen` reset-to-current-values instead of reset-to-empty, same `loading` state, same `toast.error(error.response?.data?.message || '...')` on failure).
- `submission_type` and quiz category are shown as plain read-only text in the assignment edit modal — never as editable inputs — since the backend's `updateAssignment` does not accept either field.
- No new npm dependencies in either repo.

---

### Task 1: Backend — course delete endpoint + PDF file_url

**Files:**
- Modify: `Viewebit-backend/controllers/EducatorController/courseController.js`
- Modify: `Viewebit-backend/routes/EducatorRoutes/courseRoutes.js`
- Modify: `Viewebit-backend/controllers/EducatorController/pdfHierarchyController.js`

**Interfaces:**
- Produces: `DELETE /api/educator/courses/:uuid` → `{success, message}` on success, 400 if blocked. `GET /api/educator/pdfs/categories/:categoryUuid` response's `data.category.pdfs[]` items each gain a `file_url: string` field. Tasks 3+4 consume these.

- [ ] **Step 1: Add `deleteCourse` to `courseController.js`**

Add directly below the existing `publishCourse` function (after line 126, before the `// Modules` section comment):

```js
exports.deleteCourse = async (req, res, next) => {
    try {
        const course = await Course.findOne({ where: { uuid: req.params.uuid, educator_id: req.educator.id } });
        if (!course) return next(new ErrorHandler('Course not found', 404));

        if (course.test_series_id) {
            const activeSubscriptions = await Subscription.count({
                where: { test_series_id: course.test_series_id, status: 'completed' }
            });
            if (activeSubscriptions > 0) {
                return next(new ErrorHandler('Cannot delete a course with active student subscriptions', 400));
            }
        }

        await course.destroy();
        res.status(200).json({ success: true, message: 'Course deleted successfully' });
    } catch (err) {
        console.error('Delete course error:', err);
        return next(new ErrorHandler('Failed to delete course', 500));
    }
};
```

`Course` and `Subscription` are already imported at the top of this file (`const { Course, CourseModule, Lesson, TestSeries, Category, Pdfs, Subscription } = require('../../models');`) — no new import needed. `course.destroy()` cascades to `CourseModule`/`Lesson` rows automatically (`course_id`/`course_module_id` FKs are declared `onDelete: 'CASCADE'`).

- [ ] **Step 2: Add the route**

In `Viewebit-backend/routes/EducatorRoutes/courseRoutes.js`, find:
```js
router.put('/:uuid', courseController.updateCourse);
router.patch('/:uuid/status', courseController.publishCourse);
```
Add directly below:
```js
router.delete('/:uuid', courseController.deleteCourse);
```

- [ ] **Step 3: Add `file_url` to each PDF in `getCategoryContent`'s response**

In `Viewebit-backend/controllers/EducatorController/pdfHierarchyController.js`, find the top imports:
```js
const { PdfCategory, Pdfs, sequelize } = require('../../models');
const fs = require('fs');
```
Add `const path = require('path');` directly below the `fs` import.

Then find the `getCategoryContent` function's body:
```js
        if (!category) return next(new ErrorHandler('Category not found or not owned by you', 404));

        res.status(200).json({
            success: true,
            data: {
                category,
                childCount: category.childCategories?.length || 0,
                pdfCount: category.pdfs?.length || 0
            }
        });
```
Replace with:
```js
        if (!category) return next(new ErrorHandler('Category not found or not owned by you', 404));

        const categoryJson = category.toJSON();
        categoryJson.pdfs = (categoryJson.pdfs || []).map((pdf) => ({
            ...pdf,
            file_url: `${req.protocol}://${req.get('host')}/uploads/pdfs/${path.basename(pdf.file_path)}`
        }));

        res.status(200).json({
            success: true,
            data: {
                category: categoryJson,
                childCount: categoryJson.childCategories?.length || 0,
                pdfCount: categoryJson.pdfs?.length || 0
            }
        });
```

- [ ] **Step 4: Verify the backend loads cleanly**

Run: `cd "Viewebit-backend" && node -e "require('./models'); require('./routes/index'); console.log('ALL OK');"`
Expected: `ALL OK`.

- [ ] **Step 5: Verify the new route is mounted and auth-guarded**

With the dev server running (`npm run dev` in `Viewebit-backend`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/educator/courses/00000000-0000-0000-0000-000000000000
```
Expected: `401` (proves the route exists and is guarded by `educatorAuth` — a `404` would mean it's not mounted).

- [ ] **Step 6: Commit**

```bash
cd "Viewebit-backend" && git add controllers/EducatorController/courseController.js routes/EducatorRoutes/courseRoutes.js controllers/EducatorController/pdfHierarchyController.js && git commit -m "Add course delete endpoint and PDF file_url"
```

---

### Task 2: Frontend — missing service wrapper functions

**Files:**
- Modify: `Viewebit-EducatorPanel/src/services/pdfHierarchy.ts`
- Modify: `Viewebit-EducatorPanel/src/services/quizHierarchy.ts`
- Modify: `Viewebit-EducatorPanel/src/services/courses.ts`
- Modify: `Viewebit-EducatorPanel/src/services/assignments.ts`

**Interfaces:**
- Consumes: the backend endpoints from Task 1 (`deleteCourse`) plus the already-existing `PUT` endpoints documented in Global Constraints.
- Produces: `pdfHierarchyService.updateCategory`, `pdfHierarchyService.updatePdf`, `quizHierarchyService.updateQuestion`, `coursesService.updateModule`, `coursesService.updateLesson`, `coursesService.deleteCourse`, `assignmentsService.updateAssignment`. Tasks 3–7 call these by these exact names.

- [ ] **Step 1: `pdfHierarchy.ts` — add `updateCategory`, `updatePdf`, and the `file_url` field**

Find:
```ts
export interface PdfItem {
  id: string;
  title: string;
  description?: string | null;
  original_filename: string;
  file_size: number;
  is_active: boolean;
}
```
Replace with:
```ts
export interface PdfItem {
  id: string;
  title: string;
  description?: string | null;
  original_filename: string;
  file_size: number;
  is_active: boolean;
  file_url?: string;
}
```

Find:
```ts
  createSubcategory: async (parentUuid: string, name: string, description?: string) => {
    const response = await api.post(`/educator/pdfs/categories/${parentUuid}/subcategories`, { name, description });
    return response.data;
  },

  deleteCategory: async (categoryUuid: string) => {
```
Replace with:
```ts
  createSubcategory: async (parentUuid: string, name: string, description?: string) => {
    const response = await api.post(`/educator/pdfs/categories/${parentUuid}/subcategories`, { name, description });
    return response.data;
  },

  updateCategory: async (categoryUuid: string, data: { name?: string; description?: string }) => {
    const response = await api.put(`/educator/pdfs/categories/${categoryUuid}`, data);
    return response.data;
  },

  deleteCategory: async (categoryUuid: string) => {
```

Find:
```ts
  deletePdf: async (pdfId: string) => {
    const response = await api.delete(`/educator/pdfs/pdfs/${pdfId}`);
    return response.data;
  },
};
```
Replace with:
```ts
  updatePdf: async (pdfId: string, data: { title?: string; description?: string }) => {
    const response = await api.put(`/educator/pdfs/pdfs/${pdfId}`, data);
    return response.data;
  },

  deletePdf: async (pdfId: string) => {
    const response = await api.delete(`/educator/pdfs/pdfs/${pdfId}`);
    return response.data;
  },
};
```

- [ ] **Step 2: `quizHierarchy.ts` — add `updateQuestion`**

Find:
```ts
  deleteQuestion: async (questionUuid: string) => {
    const response = await api.delete(`/educator/quizzes/questions/${questionUuid}`);
    return response.data;
  },
};
```
Replace with:
```ts
  updateQuestion: async (
    questionUuid: string,
    data: Partial<Pick<QuizQuestion, 'question_text' | 'option_a' | 'option_b' | 'option_c' | 'option_d' | 'correct_answer' | 'explanation' | 'marks'>>
  ) => {
    const response = await api.put(`/educator/quizzes/questions/${questionUuid}`, data);
    return response.data;
  },

  deleteQuestion: async (questionUuid: string) => {
    const response = await api.delete(`/educator/quizzes/questions/${questionUuid}`);
    return response.data;
  },
};
```

- [ ] **Step 3: `courses.ts` — add `deleteCourse`, `updateModule`, `updateLesson`**

Find:
```ts
  setCourseStatus: async (uuid: string, status: Course['status']) => {
    const response = await api.patch(`/educator/courses/${uuid}/status`, { status });
    return response.data;
  },
```
Add directly below:
```ts
  deleteCourse: async (uuid: string) => {
    const response = await api.delete(`/educator/courses/${uuid}`);
    return response.data;
  },
```

Find:
```ts
  reorderModules: async (courseUuid: string, orderedModuleUuids: string[]) => {
    const response = await api.patch(`/educator/courses/${courseUuid}/modules/reorder`, { orderedModuleUuids });
    return response.data;
  },

  deleteModule: async (moduleUuid: string) => {
```
Replace with:
```ts
  reorderModules: async (courseUuid: string, orderedModuleUuids: string[]) => {
    const response = await api.patch(`/educator/courses/${courseUuid}/modules/reorder`, { orderedModuleUuids });
    return response.data;
  },

  updateModule: async (moduleUuid: string, data: { title?: string }): Promise<{ success: boolean; data: CourseModule }> => {
    const response = await api.put(`/educator/courses/modules/${moduleUuid}`, data);
    return response.data;
  },

  deleteModule: async (moduleUuid: string) => {
```

Find:
```ts
  reorderLessons: async (moduleUuid: string, orderedLessonUuids: string[]) => {
    const response = await api.patch(`/educator/courses/modules/${moduleUuid}/lessons/reorder`, { orderedLessonUuids });
    return response.data;
  },

  deleteLesson: async (lessonUuid: string) => {
```
Replace with:
```ts
  reorderLessons: async (moduleUuid: string, orderedLessonUuids: string[]) => {
    const response = await api.patch(`/educator/courses/modules/${moduleUuid}/lessons/reorder`, { orderedLessonUuids });
    return response.data;
  },

  updateLesson: async (
    lessonUuid: string,
    data: {
      title?: string;
      video_url?: string;
      content_html?: string;
      pdf_id?: string;
      category_id?: number;
      duration_minutes?: number;
      is_free_preview?: boolean;
    }
  ): Promise<{ success: boolean; data: Lesson }> => {
    const response = await api.put(`/educator/courses/lessons/${lessonUuid}`, data);
    return response.data;
  },

  deleteLesson: async (lessonUuid: string) => {
```

- [ ] **Step 4: `assignments.ts` — add `updateAssignment`**

Find:
```ts
  deleteAssignment: async (uuid: string) => {
    const response = await api.delete(`/educator/assignments/${uuid}`);
    return response.data;
  },
```
Add directly above it:
```ts
  updateAssignment: async (
    uuid: string,
    data: { title?: string; max_points?: number; due_date?: string }
  ): Promise<{ success: boolean; data: Assignment }> => {
    const response = await api.put(`/educator/assignments/${uuid}`, data);
    return response.data;
  },

```

- [ ] **Step 5: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep -E "services/pdfHierarchy|services/quizHierarchy|services/courses|services/assignments"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/services/pdfHierarchy.ts src/services/quizHierarchy.ts src/services/courses.ts src/services/assignments.ts && git commit -m "Add missing update/delete service wrapper functions"
```

---

### Task 3: Frontend — PDFs page edit/view actions

**Files:**
- Modify: `Viewebit-EducatorPanel/src/pages/pdfs/PdfLibraryPage.tsx`

**Interfaces:**
- Consumes: `pdfHierarchyService.updateCategory`, `pdfHierarchyService.updatePdf` from Task 2; `PdfItem.file_url` from Task 2.

- [ ] **Step 1: Add `Pencil` and `ExternalLink` to the lucide-react import**

Find:
```tsx
import { Plus, Trash2, ChevronRight, Folder, FileText, Home, Upload } from 'lucide-react';
```
Replace with:
```tsx
import { Plus, Trash2, Pencil, ExternalLink, ChevronRight, Folder, FileText, Home, Upload } from 'lucide-react';
```

- [ ] **Step 2: Add `EditCategoryModal` and `EditPdfModal` components**

Add directly after the existing `UploadModal` component (after its closing `};` and before `export const PdfLibraryPage`):

```tsx
interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category: PdfCategoryNode | null;
}

const EditCategoryModal: React.FC<EditCategoryModalProps> = ({ isOpen, onClose, onSuccess, category }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && category) {
      setName(category.name);
      setDescription(category.description || '');
    }
  }, [isOpen, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);
    try {
      await pdfHierarchyService.updateCategory(category.uuid, { name, description: description || undefined });
      toast.success('Folder updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update folder');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit Folder</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pdf: PdfItem | null;
}

const EditPdfModal: React.FC<EditPdfModalProps> = ({ isOpen, onClose, onSuccess, pdf }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && pdf) {
      setTitle(pdf.title);
      setDescription(pdf.description || '');
    }
  }, [isOpen, pdf]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdf) return;
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setLoading(true);
    try {
      await pdfHierarchyService.updatePdf(pdf.id, { title, description: description || undefined });
      toast.success('PDF updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update PDF');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !pdf) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit PDF</h2>
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
          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Add edit-category state and wire the category rows' Edit button**

Find:
```tsx
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
```
Replace with:
```tsx
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editCategory, setEditCategory] = useState<PdfCategoryNode | null>(null);
  const [editPdf, setEditPdf] = useState<PdfItem | null>(null);
```

Find (root category row, appears once):
```tsx
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
```
Replace with:
```tsx
                  <button onClick={() => setCurrentUuid(cat.uuid)} className="flex-1 text-left flex items-center gap-2">
                    <Folder className="h-5 w-5 text-primary-500" />
                    <span className="font-medium text-gray-900">{cat.name}</span>
                  </button>
                  <button onClick={() => setEditCategory(cat)} className="p-2 text-gray-400 hover:text-primary-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setConfirmModal({ isOpen: true, type: 'category', uuid: cat.uuid, label: cat.name, loading: false })} className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
```

Find (child category row, inside the `content.category.childCategories.map` block):
```tsx
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
```
Replace with:
```tsx
                    <button onClick={() => setCurrentUuid(cat.uuid)} className="flex-1 text-left flex items-center gap-2">
                      <Folder className="h-5 w-5 text-primary-500" />
                      <span className="font-medium text-gray-900">{cat.name}</span>
                    </button>
                    <button onClick={() => setEditCategory(cat)} className="p-2 text-gray-400 hover:text-primary-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setConfirmModal({ isOpen: true, type: 'category', uuid: cat.uuid, label: cat.name, loading: false })} className="p-2 text-gray-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {content && content.category.pdfs.length > 0 && (
```

- [ ] **Step 4: Make the PDF row clickable-for-view and add its Edit button**

Find:
```tsx
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
```
Replace with:
```tsx
                {content.category.pdfs.map((pdf: PdfItem) => (
                  <div key={pdf.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <button
                      onClick={() => pdf.file_url && window.open(pdf.file_url, '_blank', 'noopener,noreferrer')}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      <FileText className="h-5 w-5 text-primary-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{pdf.title}</p>
                        <p className="text-xs text-gray-500">{(pdf.file_size / 1024).toFixed(0)} KB</p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-gray-300" />
                    </button>
                    <button onClick={() => setEditPdf(pdf)} className="p-2 text-gray-400 hover:text-primary-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setConfirmModal({ isOpen: true, type: 'pdf', uuid: pdf.id, label: pdf.title, loading: false })} className="p-2 text-gray-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
```

- [ ] **Step 5: Render the two new modals**

Find:
```tsx
      <AddCategoryModal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSuccess={refresh} parentUuid={currentUuid} />
      {currentUuid && (
        <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} onSuccess={refresh} categoryUuid={currentUuid} />
      )}
```
Replace with:
```tsx
      <AddCategoryModal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSuccess={refresh} parentUuid={currentUuid} />
      {currentUuid && (
        <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} onSuccess={refresh} categoryUuid={currentUuid} />
      )}
      <EditCategoryModal isOpen={!!editCategory} onClose={() => setEditCategory(null)} onSuccess={refresh} category={editCategory} />
      <EditPdfModal isOpen={!!editPdf} onClose={() => setEditPdf(null)} onSuccess={refresh} pdf={editPdf} />
```

- [ ] **Step 6: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep "PdfLibraryPage"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/pages/pdfs/PdfLibraryPage.tsx && git commit -m "Add edit/view actions to PDF Library page"
```

---

### Task 4: Frontend — Quiz Categories page edit actions

**Files:**
- Modify: `Viewebit-EducatorPanel/src/pages/quizzes/QuizCategoriesPage.tsx`

**Interfaces:**
- Consumes: `quizHierarchyService.updateCategory` (already existed before this plan), `quizHierarchyService.updateQuestion` from Task 2.

- [ ] **Step 1: Add `Pencil` to the lucide-react import**

Find:
```tsx
import { Plus, Trash2, ChevronRight, Folder, HelpCircle, Home } from 'lucide-react';
```
Replace with:
```tsx
import { Plus, Trash2, Pencil, ChevronRight, Folder, HelpCircle, Home } from 'lucide-react';
```

- [ ] **Step 2: Add `EditCategoryModal` and `EditQuestionModal` components**

Add directly after the existing `AddQuestionModal` component (after its closing `};` and before `export const QuizCategoriesPage`):

```tsx
interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category: QuizCategory | null;
}

const EditCategoryModal: React.FC<EditCategoryModalProps> = ({ isOpen, onClose, onSuccess, category }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && category) {
      setName(category.name);
      setDescription(category.description || '');
    }
  }, [isOpen, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);
    try {
      await quizHierarchyService.updateCategory(category.uuid, { name, description: description || undefined });
      toast.success('Category updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit Category</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  question: QuizQuestion | null;
}

const EditQuestionModal: React.FC<EditQuestionModalProps> = ({ isOpen, onClose, onSuccess, question }) => {
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState({ A: '', B: '', C: '', D: '' });
  const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [marks, setMarks] = useState('1');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && question) {
      setQuestionText(question.question_text);
      setOptions({ A: question.option_a, B: question.option_b, C: question.option_c, D: question.option_d });
      setCorrectAnswer(question.correct_answer);
      setExplanation(question.explanation || '');
      setMarks(String(question.marks));
    }
  }, [isOpen, question]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question) return;
    if (!questionText.trim() || !options.A.trim() || !options.B.trim() || !options.C.trim() || !options.D.trim()) {
      toast.error('Question text and all four options are required');
      return;
    }
    setLoading(true);
    try {
      await quizHierarchyService.updateQuestion(question.uuid, {
        question_text: questionText,
        option_a: options.A,
        option_b: options.B,
        option_c: options.C,
        option_d: options.D,
        correct_answer: correctAnswer,
        explanation: explanation || undefined,
        marks: parseInt(marks) || 1,
      });
      toast.success('Question updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update question');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !question) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit Question</h2>
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
                name="edit_correct_answer"
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
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Add edit state and wire the root-category row's Edit button**

Find:
```tsx
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
```
Replace with:
```tsx
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editCategory, setEditCategory] = useState<QuizCategory | null>(null);
  const [editQuestion, setEditQuestion] = useState<QuizQuestion | null>(null);
```

Find (root category row):
```tsx
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
```
Replace with:
```tsx
                  <button onClick={() => setCurrentUuid(cat.uuid)} className="flex-1 text-left flex items-center gap-2">
                    <Folder className="h-5 w-5 text-primary-500" />
                    <span className="font-medium text-gray-900">{cat.name}</span>
                    <span className="text-xs text-gray-400 capitalize">({cat.node_type.replace('_', ' ')})</span>
                  </button>
                  <button onClick={() => setEditCategory(cat)} className="p-2 text-gray-400 hover:text-primary-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setConfirmModal({ isOpen: true, type: 'category', uuid: cat.uuid, label: cat.name, loading: false })} className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
```

- [ ] **Step 4: Wire the subcategory row's Edit button**

Find:
```tsx
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
```
Replace with:
```tsx
                    <button onClick={() => setCurrentUuid(cat.uuid)} className="flex-1 text-left flex items-center gap-2">
                      <Folder className="h-5 w-5 text-primary-500" />
                      <span className="font-medium text-gray-900">{cat.name}</span>
                    </button>
                    <button onClick={() => setEditCategory(cat)} className="p-2 text-gray-400 hover:text-primary-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setConfirmModal({ isOpen: true, type: 'category', uuid: cat.uuid, label: cat.name, loading: false })} className="p-2 text-gray-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {content && content.category.questions.length > 0 && (
```

- [ ] **Step 5: Wire the question row's Edit button**

Find:
```tsx
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
```
Replace with:
```tsx
                    <button onClick={() => setEditQuestion(q)} className="p-2 text-gray-400 hover:text-primary-600">
                      <Pencil className="h-4 w-4" />
                    </button>
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
```

- [ ] **Step 6: Render the two new modals**

Find:
```tsx
      <AddCategoryModal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSuccess={refresh} parentUuid={currentUuid} />
      {currentUuid && (
        <AddQuestionModal isOpen={showQuestionModal} onClose={() => setShowQuestionModal(false)} onSuccess={refresh} categoryUuid={currentUuid} />
      )}
```
Replace with:
```tsx
      <AddCategoryModal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSuccess={refresh} parentUuid={currentUuid} />
      {currentUuid && (
        <AddQuestionModal isOpen={showQuestionModal} onClose={() => setShowQuestionModal(false)} onSuccess={refresh} categoryUuid={currentUuid} />
      )}
      <EditCategoryModal isOpen={!!editCategory} onClose={() => setEditCategory(null)} onSuccess={refresh} category={editCategory} />
      <EditQuestionModal isOpen={!!editQuestion} onClose={() => setEditQuestion(null)} onSuccess={refresh} question={editQuestion} />
```

- [ ] **Step 7: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep "QuizCategoriesPage"`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/pages/quizzes/QuizCategoriesPage.tsx && git commit -m "Add edit actions to Quiz Categories page"
```

---

### Task 5: Frontend — shared `EditCourseModal` + My Courses page edit/delete

**Files:**
- Create: `Viewebit-EducatorPanel/src/components/courses/EditCourseModal.tsx`
- Modify: `Viewebit-EducatorPanel/src/pages/courses/MyCoursesPage.tsx`

**Interfaces:**
- Consumes: `coursesService.updateCourse` (already existed before this plan), `coursesService.deleteCourse` from Task 2.
- Produces: `<EditCourseModal isOpen resource close onSuccess course />` — Task 6 (Course Builder) also imports and reuses this exact component.

- [ ] **Step 1: Create the shared `EditCourseModal` component**

```tsx
// Viewebit-EducatorPanel/src/components/courses/EditCourseModal.tsx
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { coursesService } from '../../services/courses';
import { Course } from '../../types';

interface EditCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  course: Course | null;
}

export const EditCourseModal: React.FC<EditCourseModalProps> = ({ isOpen, onClose, onSuccess, course }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && course) {
      setTitle(course.title);
      setDescription(course.description || '');
    }
  }, [isOpen, course]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setLoading(true);
    try {
      await coursesService.updateCourse(course.uuid, { title, description: description || undefined });
      toast.success('Course updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update course');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !course) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit Course</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course Title *</label>
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
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Wire Edit + Delete into `MyCoursesPage.tsx`**

Find:
```tsx
import { Plus, BookOpen, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { coursesService } from '../../services/courses';
import { Course, TestSeriesOption } from '../../types';
```
Replace with:
```tsx
import { Plus, BookOpen, Users, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { EditCourseModal } from '../../components/courses/EditCourseModal';
import { coursesService } from '../../services/courses';
import { Course, TestSeriesOption } from '../../types';
```

Find:
```tsx
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
```
Replace with:
```tsx
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; course: Course | null; loading: boolean }>({
    isOpen: false, course: null, loading: false,
  });

  const handleConfirmDelete = async () => {
    if (!confirmModal.course) return;
    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      await coursesService.deleteCourse(confirmModal.course.uuid);
      toast.success('Course deleted successfully');
      loadCourses();
      setConfirmModal({ isOpen: false, course: null, loading: false });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete course');
      setConfirmModal((prev) => ({ ...prev, loading: false }));
    }
  };
```

Find:
```tsx
                <button className="btn-secondary text-sm">Manage</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateCourseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={(uuid) => navigate(`/courses/${uuid}/builder`)}
      />
    </div>
  );
};
```
Replace with:
```tsx
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); setEditCourse(course); }} className="p-2 text-gray-400 hover:text-primary-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, course, loading: false }); }}
                    className="p-2 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button className="btn-secondary text-sm" onClick={(e) => e.stopPropagation()}>Manage</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateCourseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={(uuid) => navigate(`/courses/${uuid}/builder`)}
      />
      <EditCourseModal isOpen={!!editCourse} onClose={() => setEditCourse(null)} onSuccess={loadCourses} course={editCourse} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, course: null, loading: false })}
        onConfirm={handleConfirmDelete}
        title="Delete Course"
        message={`Are you sure you want to delete "${confirmModal.course?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={confirmModal.loading}
      />
    </div>
  );
};
```

Note: the "Manage" button's own `onClick={(e) => e.stopPropagation()}` doesn't change its behavior (it never had a distinct handler — the whole row already navigates on click) but keeps it inert with respect to the two new buttons beside it, matching Global Constraints' note about this fix being incidental.

- [ ] **Step 3: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep -E "MyCoursesPage|EditCourseModal"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/components/courses/EditCourseModal.tsx src/pages/courses/MyCoursesPage.tsx && git commit -m "Add shared EditCourseModal and wire edit/delete into My Courses page"
```

---

### Task 6: Frontend — Course Builder edit actions (course, modules, lessons)

**Files:**
- Modify: `Viewebit-EducatorPanel/src/pages/courses/CourseBuilderPage.tsx`

**Interfaces:**
- Consumes: `EditCourseModal` from Task 5; `coursesService.updateModule`, `coursesService.updateLesson` from Task 2.

- [ ] **Step 1: Add imports**

Find:
```tsx
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Video, FileText, HelpCircle, Radio } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { coursesService } from '../../services/courses';
import { Course, CourseModule, Lesson, LessonType, QuizCategoryOption, PdfOption } from '../../types';
```
Replace with:
```tsx
import { ArrowLeft, Plus, Trash2, Pencil, ChevronUp, ChevronDown, Video, FileText, HelpCircle, Radio } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { EditCourseModal } from '../../components/courses/EditCourseModal';
import { coursesService } from '../../services/courses';
import { Course, CourseModule, Lesson, LessonType, QuizCategoryOption, PdfOption } from '../../types';
```

- [ ] **Step 2: Add `EditModuleModal` and `EditLessonModal` components**

Add directly after the existing `LessonForm` component (after its closing `};` and before `export const CourseBuilderPage`):

```tsx
interface EditModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  module: CourseModule | null;
}

const EditModuleModal: React.FC<EditModuleModalProps> = ({ isOpen, onClose, onSuccess, module }) => {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && module) {
      setTitle(module.title);
    }
  }, [isOpen, module]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!module) return;
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setLoading(true);
    try {
      await coursesService.updateModule(module.uuid, { title });
      toast.success('Module updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update module');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !module) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit Module</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Module Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lesson: Lesson | null;
}

const EditLessonModal: React.FC<EditLessonModalProps> = ({ isOpen, onClose, onSuccess, lesson }) => {
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [pdfId, setPdfId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isFreePreview, setIsFreePreview] = useState(false);
  const [quizCategories, setQuizCategories] = useState<QuizCategoryOption[]>([]);
  const [pdfs, setPdfs] = useState<PdfOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      coursesService.getAvailableQuizCategories().then((res) => setQuizCategories(res.data || [])).catch(() => setQuizCategories([]));
      coursesService.getAvailablePdfs().then((res) => setPdfs(res.data || [])).catch(() => setPdfs([]));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && lesson) {
      setTitle(lesson.title);
      setVideoUrl(lesson.video_url || '');
      setContentHtml(lesson.content_html || '');
      setPdfId(lesson.pdf_id || '');
      setCategoryId(lesson.category_id ? String(lesson.category_id) : '');
      setIsFreePreview(lesson.is_free_preview);
    }
  }, [isOpen, lesson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lesson) return;
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setLoading(true);
    try {
      await coursesService.updateLesson(lesson.uuid, {
        title,
        video_url: lesson.lesson_type === 'video' ? videoUrl : undefined,
        content_html: lesson.lesson_type === 'document' ? contentHtml || undefined : undefined,
        pdf_id: lesson.lesson_type === 'document' && pdfId ? pdfId : undefined,
        category_id: lesson.lesson_type === 'quiz' && categoryId ? parseInt(categoryId) : undefined,
        is_free_preview: isFreePreview,
      });
      toast.success('Lesson updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update lesson');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !lesson) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit Lesson</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Lesson Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          {lesson.lesson_type === 'video' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Video URL *</label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {lesson.lesson_type === 'document' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Use an existing PDF</label>
                <select
                  value={pdfId}
                  onChange={(e) => setPdfId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">None</option>
                  {pdfs.map((pdf) => (
                    <option key={pdf.id} value={pdf.id}>{pdf.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Or write content directly</label>
                <textarea
                  value={contentHtml}
                  onChange={(e) => setContentHtml(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {lesson.lesson_type === 'quiz' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quiz Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">Select a quiz category</option>
                {quizCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {lesson.lesson_type === 'live' && (
            <p className="text-xs text-gray-500">
              Live sessions can be scheduled and linked from the Live Sessions tab once created.
            </p>
          )}

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isFreePreview} onChange={(e) => setIsFreePreview(e.target.checked)} className="h-4 w-4 text-primary-600 rounded" />
            <span className="text-sm text-gray-700">Free preview (visible even to non-enrolled students)</span>
          </label>

          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Add edit state, an Edit button next to Publish/Unpublish, and wire module/lesson Edit buttons**

Find:
```tsx
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [addingLessonToModule, setAddingLessonToModule] = useState<string | null>(null);
```
Replace with:
```tsx
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [addingLessonToModule, setAddingLessonToModule] = useState<string | null>(null);
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [editModule, setEditModule] = useState<CourseModule | null>(null);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
```

Find:
```tsx
        <button onClick={handlePublishToggle} className={course.status === 'published' ? 'btn-secondary' : 'btn-primary'}>
          {course.status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
      </div>
```
Replace with:
```tsx
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEditCourse(true)} className="btn-secondary inline-flex items-center">
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </button>
          <button onClick={handlePublishToggle} className={course.status === 'published' ? 'btn-secondary' : 'btn-primary'}>
            {course.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>
```

Find (module row actions):
```tsx
                  <button onClick={() => moveModule(course.modules || [], moduleIndex, -1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={moduleIndex === 0}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => moveModule(course.modules || [], moduleIndex, 1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={moduleIndex === (course.modules?.length || 1) - 1}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmModal({ isOpen: true, type: 'module', uuid: module.uuid, label: module.title, loading: false })}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
```
Replace with:
```tsx
                  <button onClick={() => moveModule(course.modules || [], moduleIndex, -1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={moduleIndex === 0}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => moveModule(course.modules || [], moduleIndex, 1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={moduleIndex === (course.modules?.length || 1) - 1}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditModule(module)} className="p-1 text-gray-400 hover:text-primary-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmModal({ isOpen: true, type: 'module', uuid: module.uuid, label: module.title, loading: false })}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
```

Find (lesson row actions):
```tsx
                        <button onClick={() => moveLesson(module.uuid, module.lessons, lessonIndex, -1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={lessonIndex === 0}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => moveLesson(module.uuid, module.lessons, lessonIndex, 1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={lessonIndex === module.lessons.length - 1}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmModal({ isOpen: true, type: 'lesson', uuid: lesson.uuid, label: lesson.title, loading: false })}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
```
Replace with:
```tsx
                        <button onClick={() => moveLesson(module.uuid, module.lessons, lessonIndex, -1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={lessonIndex === 0}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => moveLesson(module.uuid, module.lessons, lessonIndex, 1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={lessonIndex === module.lessons.length - 1}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditLesson(lesson)} className="p-1 text-gray-400 hover:text-primary-600">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmModal({ isOpen: true, type: 'lesson', uuid: lesson.uuid, label: lesson.title, loading: false })}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
```

- [ ] **Step 4: Render the three new modals**

Find:
```tsx
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: 'lesson', uuid: '', label: '', loading: false })}
        onConfirm={handleConfirmDelete}
        title={`Delete ${confirmModal.type === 'module' ? 'Module' : 'Lesson'}`}
        message={`Are you sure you want to delete "${confirmModal.label}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={confirmModal.loading}
      />
    </div>
  );
};
```
Replace with:
```tsx
      <EditCourseModal isOpen={showEditCourse} onClose={() => setShowEditCourse(false)} onSuccess={loadCourse} course={course} />
      <EditModuleModal isOpen={!!editModule} onClose={() => setEditModule(null)} onSuccess={loadCourse} module={editModule} />
      <EditLessonModal isOpen={!!editLesson} onClose={() => setEditLesson(null)} onSuccess={loadCourse} lesson={editLesson} />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: 'lesson', uuid: '', label: '', loading: false })}
        onConfirm={handleConfirmDelete}
        title={`Delete ${confirmModal.type === 'module' ? 'Module' : 'Lesson'}`}
        message={`Are you sure you want to delete "${confirmModal.label}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={confirmModal.loading}
      />
    </div>
  );
};
```

- [ ] **Step 5: Verify typecheck and build**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit`
Expected: no errors.

Run: `cd "Viewebit-EducatorPanel" && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/pages/courses/CourseBuilderPage.tsx && git commit -m "Add edit actions for course, modules, and lessons in Course Builder"
```

---

### Task 7: Frontend — Assignments page edit action

**Files:**
- Modify: `Viewebit-EducatorPanel/src/pages/assignments/AssignmentsPage.tsx`

**Interfaces:**
- Consumes: `assignmentsService.updateAssignment` from Task 2.

- [ ] **Step 1: Add `Pencil` to the lucide-react import**

Find:
```tsx
import { Plus, ClipboardList, Trash2 } from 'lucide-react';
```
Replace with:
```tsx
import { Plus, ClipboardList, Trash2, Pencil } from 'lucide-react';
```

- [ ] **Step 2: Add `EditAssignmentModal` component**

Add directly after the existing `CreateAssignmentModal` component (after its closing `};` and before `export const AssignmentsPage`):

```tsx
interface EditAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assignment: Assignment | null;
}

const EditAssignmentModal: React.FC<EditAssignmentModalProps> = ({ isOpen, onClose, onSuccess, assignment }) => {
  const [title, setTitle] = useState('');
  const [maxPoints, setMaxPoints] = useState('100');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && assignment) {
      setTitle(assignment.title);
      setMaxPoints(String(assignment.max_points));
      setDueDate(assignment.due_date ? assignment.due_date.slice(0, 16) : '');
    }
  }, [isOpen, assignment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setLoading(true);
    try {
      await assignmentsService.updateAssignment(assignment.uuid, {
        title,
        max_points: parseInt(maxPoints) || 100,
        due_date: dueDate || undefined,
      });
      toast.success('Assignment updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update assignment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !assignment) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit Assignment</h2>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Submission Type</label>
              <p className="px-3 py-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md capitalize">
                {assignment.submission_type.replace('_', ' ')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Points</label>
              <input
                type="number"
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {assignment.submission_type === 'quiz' && assignment.quizCategory && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Category</label>
              <p className="px-3 py-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md">
                {assignment.quizCategory.name}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Add edit state and wire the Edit button**

Find:
```tsx
  const [showModal, setShowModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, assignment: null as Assignment | null, loading: false });
```
Replace with:
```tsx
  const [showModal, setShowModal] = useState(false);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, assignment: null as Assignment | null, loading: false });
```

Find:
```tsx
                <button
                  onClick={() => setConfirmModal({ isOpen: true, assignment, loading: false })}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateAssignmentModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={loadAssignments} />
```
Replace with:
```tsx
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditAssignment(assignment)} className="p-2 text-gray-400 hover:text-primary-600">
                    <Pencil className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setConfirmModal({ isOpen: true, assignment, loading: false })}
                    className="p-2 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateAssignmentModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={loadAssignments} />
      <EditAssignmentModal isOpen={!!editAssignment} onClose={() => setEditAssignment(null)} onSuccess={loadAssignments} assignment={editAssignment} />
```

- [ ] **Step 4: Verify typecheck and build**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit`
Expected: no errors.

Run: `cd "Viewebit-EducatorPanel" && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual click-through of all 4 areas**

With `Viewebit-backend` running (`npm run dev`) and `Viewebit-EducatorPanel` running (`npm run dev`):
1. PDFs: edit a folder's name/description, edit a PDF's title/description, click a PDF row and confirm the file opens in a new tab.
2. Quiz Categories: edit a category's name/description, edit a question's text/options/correct answer/marks.
3. My Courses: edit a course's title/description from the list; delete a course with no linked test series (should succeed); if a course is linked to a test series with an active subscription, confirm delete is blocked with a toast.
4. Course Builder: edit the course from within the builder, edit a module's title, edit a lesson (for each lesson type: video, document, quiz).
5. Assignments: edit an assignment's title/max points/due date; confirm submission type and quiz category (if any) show as read-only text, not editable inputs.
6. Regression: confirm all existing create/delete/reorder/publish actions across all 4 areas still work unchanged.

- [ ] **Step 6: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/pages/assignments/AssignmentsPage.tsx && git commit -m "Add edit action to Assignments page"
```
