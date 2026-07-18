# Educator Panel: Student Insights (Students / Test Attempts / Subscriptions)

## Context

The Admin Panel already has Students, Test Attempts, and Subscriptions pages, but they're
institution-wide — an educator has no way to see which students are actually engaging with
*their own* courses and quizzes. The user asked for the equivalent visibility inside the
Educator Panel (`Viewebit-EducatorPanel`), explicitly excluding Admissions (that stays an
institution/Admin-level concern, not tied to a specific educator).

There is no direct student↔educator membership table anywhere in the schema. "Belongs to this
educator" has to be derived from three independent engagement paths that already exist:

1. **Paid access** — `Course.educator_id` → `Course.test_series_id` → `Subscription` (`user_id`,
   `test_series_id`, `status`).
2. **Free course engagement** — `Course.educator_id` → `CourseModule` → `Lesson` →
   `LessonProgress` (`user_id`, `lesson_id`), independent of any payment.
3. **Quiz attempts** — `Category.educator_id` (quiz categories are educator-owned, tree via
   `parent_category_id`) → completed `TestSession` rows whose `session_data.category_uuid`
   matches one of that educator's category ids (root or descendant) → `User` via `user_id`.

All three paths are real and already partially proven in the codebase (`educatorDashboardController.js`
and `courseController.getMyCourses` already do path 1 for per-course student counts;
`assignmentController.js` already demonstrates the "scope by educator_id first, then narrow
child tables" convention this feature will reuse).

Reference for UI/API conventions: Admin Panel's own `StudentsPage.tsx`, `TestAttemptsPage.tsx`,
and `SubscriptionsPage.tsx` — all three use hand-rolled tables + manual pagination + debounced
search (confirmed: none of them use the shared `DataTable` component, even though one exists in
both AdminPanel and EducatorPanel — it's dead code, not the real convention). This feature
follows what Admin's pages *actually do*, not the unused component.

## Decisions (from user Q&A)

- **Student scope**: "belongs to educator" = any of the three paths above (paid, free, or
  quiz-only) — a student shows up as "theirs" if they've touched the educator's content in any
  way.
- **Page structure**: three separate sidebar entries/pages (Students, Test Attempts,
  Subscriptions), mirroring Admin's structure exactly rather than one tabbed page.
- **Test Attempts view**: one row per student (total attempts, completed count, latest attempt),
  with a drill-down modal for full history — same shape as Admin's version, just scoped.
- **Subscriptions actions**: read access to status/expiry/amount, **plus** a "Grant Access"
  action letting an educator manually grant a student free access to *one of their own courses*
  (creates a `Subscription` row). No status-editing/refund controls — those stay Admin-only.

## Architecture

New shared backend helper, `Viewebit-backend/utils/educatorScope.js`:

```js
getEducatorCourseIds(educatorId)      // Course.id[] owned by this educator
getEducatorTestSeriesIds(educatorId)  // test_series_id[] from those courses (non-null only)
getEducatorCategoryIds(educatorId)    // Category.id[]/uuid[] — educator's root categories
                                       // PLUS all descendants (walk down parent_category_id)
```

All three new controllers call this helper first to get scoped ID lists, then filter the
relevant student-facing tables by those ids — the same "scope first, query second" convention
`assignmentController.js` and `courseController.js` already use. This avoids re-deriving the same
scoping logic three times across three controllers.

## Students page

Route: `/students` (new sidebar entry, right after "My Courses").

One row per student, unioned (by `user_id`, de-duplicated) from:
- `LessonProgress` joined through the educator's `Course → CourseModule → Lesson` chain
- `Subscription` where `test_series_id` is in the educator's test-series-id set
- `TestSession` where `session_data.category_uuid` is in the educator's category-id set

Columns: name/email, course chips (or "N courses" if many), an access-type badge (**Paid** /
**Free** / **Quiz only** — paid takes priority if a student has both), last activity date
(latest of `LessonProgress.updated_at` / `TestSession.completed_at`), quiz attempt count.

Controls: debounced search (name/email), access-type filter, manual pagination — matching
Admin's `StudentsPage.tsx` pattern exactly.

Backend: `GET /educator/students` (`routes/EducatorRoutes/studentInsightsRoutes.js`), params
`page, limit, search, access_type`.

## Test Attempts page

Route: `/test-attempts`.

One row per student: total attempts, completed count, latest attempt summary (category name,
score, percentage, completed date) — computed only from `TestSession` rows whose
`category_uuid` falls in this educator's category-id set. Clicking a row opens a drill-down
modal with that student's full attempt history (each session with a category breadcrumb, score,
percentage, time spent, date), reusing the same breadcrumb-walking logic Admin's
`getStudentTestAttemptsForAdmin` already has, re-scoped so an educator never sees a student's
attempts on a *different* educator's quizzes.

Backend:
- `GET /educator/test-attempts` — grouped/aggregated list.
- `GET /educator/test-attempts/:studentUuid` — full history for one student, filtered to this
  educator's category-id set only.

## Subscriptions page

Route: `/subscriptions`.

Rows: `Subscription` where `test_series_id` is in the educator's test-series-id set — reusing
Admin's `getAllSubscriptions` search/sort/pagination shape, just pre-scoped. Columns: student,
course (resolved via test series → course), amount paid, status, purchase date, expiry date.
PDF-only subscriptions (`test_series_id: null`) are out of scope — PDFs have no educator owner
in this schema, so there's nothing to scope them to.

**Grant Access** modal: pick a student (search by email) and one of *the educator's own* courses
that has a linked test series (courses without one are excluded from the picker, with a note
explaining why) — creates a `Subscription` with `status: 'completed'`, `amount_paid: 0`,
`metadata: { granted_by_educator: true }`. Reuses Admin's `createManualSubscription` logic,
constrained so an educator can only grant access to their own courses.

Backend:
- `GET /educator/subscriptions`
- `GET /educator/subscriptions/stats` (basic counts for stat tiles: active/expired/total granted)
- `POST /educator/subscriptions/manual`

## Routing & navigation

Backend: new `routes/EducatorRoutes/studentInsightsRoutes.js`, mounted at `/api/educator`
alongside the other educator route files in `routes/index.js`, behind the existing
`educatorAuth` middleware — no new auth pattern.

Frontend (`Viewebit-EducatorPanel`): three new pages under `src/pages/students/`,
`src/pages/test-attempts/`, `src/pages/subscriptions/`; three new service files
(`services/students.ts`, `services/testAttempts.ts`, `services/subscriptions.ts`) following the
existing `services/courses.ts`/`services/assignments.ts` axios-wrapper convention; three new
routes in `src/App.tsx`; three new sidebar entries in `src/components/layout/Sidebar.tsx`.

## Error handling & edge cases

- Educator with zero courses/categories → empty states ("No students yet" / "No attempts yet" /
  "No subscriptions yet"), not errors.
- The category descendant-walk is computed per-request, not cached — acceptable at current data
  volume; flagged as a future optimization, not solved here.
- Grant-access course picker only shows the educator's courses that have a `test_series_id`;
  courses without one are excluded with an explanatory note rather than silently failing on
  submit.
- A student with both paid and free engagement shows the **Paid** badge (paid takes priority)
  on the Students page.

## Verification

- Seed/confirm a test educator with at least one paid course (test-series-linked), one free
  course, and one quiz category with a completed `TestSession` from a student who is enrolled in
  neither course.
- `GET /educator/students` returns that student exactly once, with the correct access-type badge
  for each of the three engagement types (test with three different students, one per path).
- `GET /educator/test-attempts` and its drill-down endpoint return only sessions tied to this
  educator's own categories — confirm a session on a *different* educator's category is excluded.
- `GET /educator/subscriptions` returns only subscriptions tied to this educator's test series;
  confirm a subscription for another educator's course is excluded.
- Grant Access modal: grant a student free access to one of the educator's courses, confirm the
  resulting `Subscription` row appears in the list with `amount_paid: 0` and the student gains
  course access (`hasAccess: true` on the student-facing course detail endpoint).
- Click through all three pages in the browser: search, filter, pagination, and the drill-down
  modal all work end-to-end.
