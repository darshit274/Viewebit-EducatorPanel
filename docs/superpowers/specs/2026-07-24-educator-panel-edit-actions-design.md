# Educator Panel: Edit/Delete/View actions for PDFs, Quiz Categories, Courses, and Assignments

## Context

Across the Educator Panel, four content-management screens let an educator create content but never edit it afterward — PDFs, Quiz Categories (and questions), My Courses (courses/modules/lessons), and Assignments each only expose a Delete action (or, for PDFs, not even that on the file itself) once an item exists. Investigation found this is overwhelmingly a **frontend-only gap**: for every entity except the course itself, the backend already has a fully-working `PUT` update endpoint that no UI anywhere calls, and in one case (quiz-category update) the frontend service function already exists too — it's just never invoked from the page. The one real backend gap is course-level delete, which doesn't exist at all today (only module/lesson delete do).

This spec closes all of these gaps: add edit UI wherever an update endpoint already exists, add the thin service-layer wrapper functions that are missing, and add the one missing backend capability (course delete, safety-gated the same way quiz-category and PDF-category delete already are).

## Shared Pattern

Every area follows the same shape:
- An Edit (pencil icon, `lucide-react`, already used elsewhere in this codebase) button placed next to each existing Delete button.
- A small modal component per entity, following the existing per-page modal convention already established (`AddCategoryModal`, `AddQuestionModal`, `CreateAssignmentModal`, `LessonForm`, `ConfirmModal`) — no new shared abstraction/library, just one more modal per page.
- Edit modals mirror the fields already collected on that entity's corresponding "create" form (per the minimal-scope decision below) and pre-fill from the item being edited.
- On submit, calls a `updateX` function in that entity's `services/*.ts` file. This function already exists for 2 of 8 entities (quiz category, course) and needs adding for the other 6 (PDF category, PDF, question, module, lesson, assignment) — in every one of those 6 cases the backend endpoint it calls already exists and works.
- Failures surface via `toast.error(error.response?.data?.message || '...')`, matching the existing pattern in every create/delete flow in these same files.

**Explicit scope decisions:**
- Edit forms are minimal: they expose only the fields already collected on the corresponding create form. Several fields the backend already accepts but no UI anywhere surfaces today (quiz category `test_duration_minutes`/`negative_marking_enabled`/`negative_marks_per_wrong`; assignment `description`/`allow_late_submission`; course `thumbnail_url`/`completion_threshold_percent`; `is_active` toggles across several entities) are explicitly **out of scope** for this pass — a future enhancement, not bundled in here.
- Lesson editing is included even though the user didn't explicitly mention it, since it's the identical gap one level deeper in Course Builder.
- Course delete is added as new backend + frontend work.

## 1. PDFs (`src/pages/pdfs/PdfLibraryPage.tsx`)

- **Category row**: add an Edit (pencil) icon next to the existing Delete icon → opens `EditCategoryModal` pre-filled with `name`/`description` → calls new `pdfHierarchyService.updateCategory(categoryUuid, {name, description})` → hits the already-working `PUT /educator/pdfs/categories/:categoryUuid` (`updateCategory` in `pdfHierarchyController.js`).
- **PDF row**: becomes clickable for **view** — clicking the title/icon area opens the underlying file directly in a new tab (`window.open(...)`, using whatever field the list/detail response already exposes as the servable file URL — confirm exact field name during implementation, e.g. `file_url`/`file_path`). Also gets its own Edit (pencil) icon → opens `EditPdfModal` pre-filled with `title`/`description` → calls new `pdfHierarchyService.updatePdf(pdfId, {title, description})` → hits the already-working `PUT /educator/pdfs/pdfs/:pdfId` (`updatePdfMetadata` in the same controller).
- Delete stays exactly as-is for both (already correct).

## 2. Quiz Categories (`src/pages/quizzes/QuizCategoriesPage.tsx`)

- **Category/subcategory rows**: add an Edit (pencil) icon next to Delete → opens `EditCategoryModal` pre-filled with `name`/`description` → calls the **already-existing** `quizHierarchyService.updateCategory(categoryUuid, {name, description})` (pure UI + wiring addition — this service function is already implemented) → hits the already-working `PUT /educator/quizzes/categories/:categoryUuid`.
- **Question rows**: add an Edit (pencil) icon next to Delete → opens `EditQuestionModal`, mirroring `AddQuestionModal`'s exact fields (`question_text`, `option_a`–`option_d`, `correct_answer`, `explanation`, `marks`), pre-filled with current values → calls new `quizHierarchyService.updateQuestion(questionUuid, data)` → hits the already-working `PUT /educator/quizzes/questions/:questionUuid` (`updateQuestion` in `quizHierarchyController.js`).
- Delete stays exactly as-is for both.

## 3. My Courses, Course Builder, and course delete

- **Course list (`src/pages/courses/MyCoursesPage.tsx`)**: fix the row's "Manage" button to call `e.stopPropagation()` (currently redundant with the row's own navigate-on-click, since both do the same thing today — this just keeps the new buttons from also triggering navigation). Add two new icon buttons per row:
  - Edit (pencil) → `EditCourseModal` pre-filled with `title`/`description` → calls the **already-existing** `coursesService.updateCourse(uuid, {title, description})` → hits the already-working `PUT /educator/courses/:uuid` (`updateCourse` in `courseController.js`).
  - Delete (trash) → `ConfirmModal` (matching the existing pattern) → calls new `coursesService.deleteCourse(uuid)` → hits a **new** `DELETE /educator/courses/:uuid`, implemented in `courseController.js`/`courseRoutes.js`. Blocked server-side (400) if the course's linked `test_series_id` has any `completed` `Subscription` row — mirroring the existing "blocked if non-empty" convention already used by quiz-category delete (blocks on children/questions) and PDF-category delete (blocks on children/PDFs). The blocked-error message surfaces via toast.
- **Course Builder — course level (`src/pages/courses/CourseBuilderPage.tsx`)**: the existing Publish/Unpublish button gets a sibling Edit button, reusing the same `EditCourseModal`.
- **Course Builder — modules**: each module row gets an Edit (pencil) icon alongside the existing move-up/move-down/delete → `EditModuleModal` with just a `title` field, pre-filled → calls new `coursesService.updateModule(moduleUuid, {title})` → hits the already-working `PUT /educator/courses/modules/:moduleUuid` (`updateModule` in `courseController.js`).
- **Course Builder — lessons**: each lesson row gets an Edit (pencil) icon alongside move-up/move-down/delete → `EditLessonModal`, mirroring the existing `LessonForm` component's exact fields (`title`, `video_url`, `content_html`, `pdf_id`, `category_id`, `duration_minutes`, `is_free_preview`), pre-filled with current values → calls new `coursesService.updateLesson(lessonUuid, data)` → hits the already-working `PUT /educator/courses/lessons/:lessonUuid` (`updateLesson` in `courseController.js`).

## 4. Assignments (`src/pages/assignments/AssignmentsPage.tsx`)

Each assignment row gets an Edit (pencil) icon next to the existing Delete icon → `EditAssignmentModal`, mirroring `CreateAssignmentModal`'s editable fields (`title`, `max_points`, `due_date`), pre-filled with current values. `submission_type` and quiz category are shown as plain read-only text (for context) — **not** editable inputs, since the backend's `updateAssignment` endpoint does not accept either field (by design: changing `category_id` after students may have submitted would be destructive). Submits via new `assignmentsService.updateAssignment(uuid, data)` → hits the already-working `PUT /educator/assignments/:uuid` (`updateAssignment` in `assignmentController.js`).

## Error Handling

- Every edit modal shows a toast on failure (`error.response?.data?.message || 'Failed to update...'`), matching the existing pattern in every create/delete flow in these same files.
- Course delete's "blocked — has active subscriptions" 400 response surfaces as a toast (not a silent failure), matching how quiz-category/PDF-category delete already communicate their own blocked-state today.
- No new client-side validation beyond what each entity's existing create-form already enforces (e.g. required `title`) — edit forms reuse the same validation rules, not new ones.

## Critical Files

- `Viewebit-EducatorPanel/src/pages/pdfs/PdfLibraryPage.tsx`, `src/services/pdfHierarchy.ts`
- `Viewebit-EducatorPanel/src/pages/quizzes/QuizCategoriesPage.tsx`, `src/services/quizHierarchy.ts`
- `Viewebit-EducatorPanel/src/pages/courses/MyCoursesPage.tsx`, `src/pages/courses/CourseBuilderPage.tsx`, `src/services/courses.ts`
- `Viewebit-EducatorPanel/src/pages/assignments/AssignmentsPage.tsx`, `src/services/assignments.ts`
- `Viewebit-backend/controllers/EducatorController/courseController.js`, `routes/EducatorRoutes/courseRoutes.js` (new `deleteCourse` + route)

## Testing/Verification

No automated test framework exists in either repo (`Viewebit-backend`'s `npm test` is a stub; `Viewebit-EducatorPanel` has none). Verification: `node -e` require-checks + curl for the one new backend route (`DELETE /educator/courses/:uuid`, including the blocked-if-active-subscriptions case); `npx tsc --noEmit` + `npm run build` for the frontend; a manual click-through of every new edit/view/delete action across all 4 areas once a dev server is running.
