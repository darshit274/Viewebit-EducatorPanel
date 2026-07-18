# Educator Student Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give educators visibility into which students are engaging with their own courses and quizzes, via three new Educator Panel pages — Students, Test Attempts, and Subscriptions — mirroring the Admin Panel's equivalent pages but scoped to one educator.

**Architecture:** A shared backend helper (`utils/educatorScope.js`) resolves an educator's owned Courses and quiz-Category-tree (including descendants) once; three new controller functions each filter the relevant student-facing tables (`LessonProgress`, `Subscription`, `TestSession`) down to those scoped IDs, following the same "scope first, query second" convention already used by `assignmentController.js`. Three new Educator Panel pages consume these via three new service files.

**Tech Stack:** Node/Express 5 + Sequelize 6 + MySQL (backend), React 19 + TypeScript + Tailwind + axios (Viewebit-EducatorPanel). No test framework exists anywhere in either repo today (confirmed: `Viewebit-backend`'s `npm test` is a stub, `Viewebit-EducatorPanel` has no test script or test files at all) — every other phase of this project has been verified via `curl`/browser click-through instead of automated tests. This plan follows that same established convention: each task's "test" step is a manual `curl` command or dev-server check with an exact expected response, not an automated test file.

## Global Constraints

- Every new backend route sits behind the existing `educatorAuth` middleware (`utils/EducatorAuth.js`) — no new auth pattern.
- Every controller query scopes by `req.educator.id` first, then narrows child tables — never a global query filtered client-side (existing convention from `assignmentController.js`/`courseController.js`).
- Frontend pages follow the existing hand-rolled table + debounced search + manual pagination convention (confirmed: Admin Panel's own Students/Test-Attempts/Subscriptions pages don't use the shared `DataTable` component even though one exists — it's dead code, not the real convention).
- No new npm dependencies — `crypto.randomUUID()` (Node builtin) replaces the `uuid` package for generating a manual-grant transaction ID.
- A student with both paid and free engagement shows the **Paid** badge (paid takes priority).
- PDF-only subscriptions (`test_series_id: null`) are out of scope for the Subscriptions page — PDFs have no educator owner in this schema.

---

### Task 1: Backend — shared educator-scoping helper

**Files:**
- Create: `Viewebit-backend/utils/educatorScope.js`

**Interfaces:**
- Produces: `getEducatorCourses(educatorId): Promise<Array<{id, uuid, title, test_series_id}>>`, `getEducatorCategoryIds(educatorId): Promise<{ids: number[], uuids: string[]}>` — every later task calls these two functions and only these two.

- [ ] **Step 1: Write the helper module**

```js
// Viewebit-backend/utils/educatorScope.js
const { Course, Category } = require('../models');

// Full Course rows owned by this educator — callers derive course ids /
// test series ids from this rather than issuing separate queries.
const getEducatorCourses = async (educatorId) => {
    const courses = await Course.findAll({
        where: { educator_id: educatorId },
        attributes: ['id', 'uuid', 'title', 'test_series_id'],
    });
    return courses.map((c) => c.toJSON());
};

// Returns every Category id/uuid owned by this educator, PLUS all
// descendants (walking down parent_category_id) — a TestSession only
// counts toward this educator if its session_data.category_uuid matches
// one of these uuids.
const getEducatorCategoryIds = async (educatorId) => {
    const roots = await Category.findAll({
        where: { educator_id: educatorId },
        attributes: ['id', 'uuid'],
    });

    const ids = roots.map((r) => r.id);
    const uuids = roots.map((r) => r.uuid);

    let frontier = ids.slice();
    while (frontier.length > 0) {
        const children = await Category.findAll({
            where: { parent_category_id: frontier },
            attributes: ['id', 'uuid'],
        });
        if (children.length === 0) break;
        ids.push(...children.map((c) => c.id));
        uuids.push(...children.map((c) => c.uuid));
        frontier = children.map((c) => c.id);
    }

    return { ids, uuids };
};

module.exports = { getEducatorCourses, getEducatorCategoryIds };
```

- [ ] **Step 2: Verify it loads and returns sane values**

Run:
```bash
cd "Viewebit-backend" && node -e "
require('./models');
const { getEducatorCourses, getEducatorCategoryIds } = require('./utils/educatorScope');
const { Educator } = require('./models');
(async () => {
  const educator = await Educator.findOne();
  if (!educator) { console.log('No educator seeded — skipping, will verify against real data in Task 6'); process.exit(0); }
  console.log('courses:', await getEducatorCourses(educator.id));
  console.log('categoryIds:', await getEducatorCategoryIds(educator.id));
  process.exit(0);
})();
"
```
Expected: no thrown errors; either "No educator seeded..." or two logged objects (`courses` an array, `categoryIds` an object with `ids`/`uuids` arrays).

- [ ] **Step 3: Commit**

```bash
cd "Viewebit-backend" && git add utils/educatorScope.js && git commit -m "Add shared educator-scoping helper for course/category ownership"
```

---

### Task 2: Backend — Students endpoint

**Files:**
- Create: `Viewebit-backend/controllers/EducatorController/studentInsightsController.js` (this task writes `listStudents` only; Tasks 3–5 append to this same file)
- Create: `Viewebit-backend/routes/EducatorRoutes/studentInsightsRoutes.js`
- Modify: `Viewebit-backend/routes/index.js`

**Interfaces:**
- Consumes: `getEducatorCourses`, `getEducatorCategoryIds` from Task 1.
- Produces: `GET /api/educator/students` → `{ success: true, data: StudentRow[], pagination: {total, page, limit, totalPages} }` where `StudentRow = { uuid, name, email, courses: string[], accessType: 'paid'|'free'|'quiz', lastActivity: string|null, quizAttempts: number }`. Tasks 7+ (frontend) depend on this exact shape.

- [ ] **Step 1: Create the controller with `listStudents`**

```js
// Viewebit-backend/controllers/EducatorController/studentInsightsController.js
const ErrorHandler = require('../../utils/default/errorHandler');
const { Course, CourseModule, Lesson, LessonProgress, Subscription, TestSession, User } = require('../../models');
const { Op } = require('sequelize');
const { getEducatorCourses, getEducatorCategoryIds } = require('../../utils/educatorScope');

exports.listStudents = async (req, res, next) => {
    try {
        const { search = '', access_type = 'all', page = 1, limit = 20 } = req.query;
        const educatorId = req.educator.id;

        const courses = await getEducatorCourses(educatorId);
        const courseIds = courses.map((c) => c.id);
        const courseIdToTitle = new Map(courses.map((c) => [c.id, c.title]));
        const testSeriesIdToCourse = new Map(courses.filter((c) => c.test_series_id).map((c) => [c.test_series_id, c]));
        const testSeriesIds = [...testSeriesIdToCourse.keys()];
        const { uuids: categoryUuids } = await getEducatorCategoryIds(educatorId);

        const studentMap = new Map();
        const touch = (userId) => {
            if (!studentMap.has(userId)) {
                studentMap.set(userId, { accessTypes: new Set(), courseTitles: new Set(), lastActivity: null, quizAttempts: 0, name: null, email: null });
            }
            return studentMap.get(userId);
        };
        const bumpActivity = (entry, date) => {
            if (date && (!entry.lastActivity || new Date(date) > entry.lastActivity)) entry.lastActivity = new Date(date);
        };

        // Path 1: paid — Subscription rows against this educator's test series
        if (testSeriesIds.length > 0) {
            const subs = await Subscription.findAll({
                where: { test_series_id: testSeriesIds, status: 'completed' },
                include: [{ model: User, as: 'user', attributes: ['uuid', 'username', 'email'] }],
            });
            subs.forEach((sub) => {
                if (!sub.user) return;
                const entry = touch(sub.user.uuid);
                entry.accessTypes.add('paid');
                entry.name = sub.user.username;
                entry.email = sub.user.email;
                const course = testSeriesIdToCourse.get(sub.test_series_id);
                if (course) entry.courseTitles.add(course.title);
                bumpActivity(entry, sub.purchase_date);
            });
        }

        // Path 2: free/paid course engagement — LessonProgress through this educator's Course -> CourseModule -> Lesson chain
        if (courseIds.length > 0) {
            const modules = await CourseModule.findAll({ where: { course_id: courseIds }, attributes: ['id', 'course_id'] });
            const moduleIdToCourseId = new Map(modules.map((m) => [m.id, m.course_id]));
            const moduleIds = modules.map((m) => m.id);

            if (moduleIds.length > 0) {
                const lessons = await Lesson.findAll({ where: { course_module_id: moduleIds }, attributes: ['id', 'course_module_id'] });
                const lessonIdToCourseId = new Map(lessons.map((l) => [l.id, moduleIdToCourseId.get(l.course_module_id)]));
                const lessonIds = lessons.map((l) => l.id);

                if (lessonIds.length > 0) {
                    const progress = await LessonProgress.findAll({
                        where: { lesson_id: lessonIds },
                        include: [{ model: User, as: 'user', attributes: ['uuid', 'username', 'email'] }],
                    });
                    progress.forEach((p) => {
                        if (!p.user) return;
                        const entry = touch(p.user.uuid);
                        entry.accessTypes.add('free');
                        entry.name = p.user.username;
                        entry.email = p.user.email;
                        const title = courseIdToTitle.get(lessonIdToCourseId.get(p.lesson_id));
                        if (title) entry.courseTitles.add(title);
                        bumpActivity(entry, p.updated_at || p.completed_at);
                    });
                }
            }
        }

        // Path 3: quiz-only attempts — completed TestSessions matching this educator's category tree
        if (categoryUuids.length > 0) {
            const completedSessions = await TestSession.findAll({ where: { status: 'completed' } });
            const scoped = completedSessions.filter((s) => categoryUuids.includes(s.session_data?.category_uuid));
            const userIds = [...new Set(scoped.map((s) => s.user_id))];
            if (userIds.length > 0) {
                const users = await User.findAll({ where: { uuid: userIds }, attributes: ['uuid', 'username', 'email'] });
                const userMap = new Map(users.map((u) => [u.uuid, u]));
                scoped.forEach((s) => {
                    const user = userMap.get(s.user_id);
                    if (!user) return;
                    const entry = touch(s.user_id);
                    entry.accessTypes.add('quiz');
                    entry.name = user.username;
                    entry.email = user.email;
                    entry.quizAttempts += 1;
                    bumpActivity(entry, s.completed_at);
                });
            }
        }

        let students = Array.from(studentMap.entries()).map(([uuid, entry]) => ({
            uuid,
            name: entry.name,
            email: entry.email,
            courses: Array.from(entry.courseTitles),
            accessType: entry.accessTypes.has('paid') ? 'paid' : entry.accessTypes.has('free') ? 'free' : 'quiz',
            lastActivity: entry.lastActivity,
            quizAttempts: entry.quizAttempts,
        }));

        if (search) {
            const s = String(search).toLowerCase();
            students = students.filter((st) => st.name?.toLowerCase().includes(s) || st.email?.toLowerCase().includes(s));
        }
        if (access_type !== 'all') {
            students = students.filter((st) => st.accessType === access_type);
        }

        students.sort((a, b) => (b.lastActivity ? new Date(b.lastActivity).getTime() : 0) - (a.lastActivity ? new Date(a.lastActivity).getTime() : 0));

        const total = students.length;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const paged = students.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        res.status(200).json({
            success: true,
            data: paged,
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (err) {
        console.error('List students error:', err);
        return next(new ErrorHandler('Failed to fetch students', 500));
    }
};
```

- [ ] **Step 2: Create the routes file**

```js
// Viewebit-backend/routes/EducatorRoutes/studentInsightsRoutes.js
const express = require('express');
const router = express.Router();

const studentInsightsController = require('../../controllers/EducatorController/studentInsightsController');
const { educatorAuth } = require('../../utils/EducatorAuth');

router.use(educatorAuth);

router.get('/students', studentInsightsController.listStudents);

module.exports = router;
```

- [ ] **Step 3: Mount the routes in `routes/index.js`**

Find this block (around line 12, among the other `EducatorRoutes` requires):
```js
const EducatorPdfHierarchyRoutes = require("./EducatorRoutes/pdfHierarchyRoutes");
```
Add directly below it:
```js
const EducatorStudentInsightsRoutes = require("./EducatorRoutes/studentInsightsRoutes");
```

Find this block (around line 52, among the other `router.use("/educator...")` calls):
```js
router.use("/educator/pdfs", EducatorPdfHierarchyRoutes);
```
Add directly below it:
```js
router.use("/educator", EducatorStudentInsightsRoutes);
```

- [ ] **Step 4: Verify the backend loads cleanly**

Run: `cd "Viewebit-backend" && node -e "require('./models'); require('./routes/index'); console.log('ALL OK');"`
Expected output: `ALL OK` (no thrown error).

- [ ] **Step 5: Verify the route is mounted (auth-guarded, not missing)**

Run: `cd "Viewebit-backend" && npm run dev` in one terminal, then in another:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/educator/students
```
Expected: `401` (proves the route exists and is guarded by `educatorAuth` — a `404` would mean it's not mounted).

- [ ] **Step 6: Commit**

```bash
cd "Viewebit-backend" && git add controllers/EducatorController/studentInsightsController.js routes/EducatorRoutes/studentInsightsRoutes.js routes/index.js && git commit -m "Add educator-scoped Students endpoint"
```

---

### Task 3: Backend — Test Attempts endpoints

**Files:**
- Modify: `Viewebit-backend/controllers/EducatorController/studentInsightsController.js` (append)
- Modify: `Viewebit-backend/routes/EducatorRoutes/studentInsightsRoutes.js` (append)

**Interfaces:**
- Consumes: `getEducatorCategoryIds` from Task 1.
- Produces: `GET /api/educator/test-attempts` → `{ success, data: TestAttemptSummary[], pagination }` where `TestAttemptSummary = { studentUuid, studentName, studentEmail, totalAttempts, completedAttempts, latestAttempt: { sessionId, categoryName, percentage, finalScore, completedAt } }`. `GET /api/educator/test-attempts/:studentUuid` → `{ success, data: { student: {uuid,name,email}, attempts: TestAttemptDetail[] } }` where `TestAttemptDetail = { sessionId, categoryName, percentage, finalScore, totalCorrect, totalWrong, totalQuestions, timeSpentSeconds, completedAt }`. Task 8 (frontend) depends on these exact shapes.

- [ ] **Step 1: Append `listTestAttempts` and `getStudentTestAttempts` to the controller**

Add to the end of `Viewebit-backend/controllers/EducatorController/studentInsightsController.js`:

```js
exports.listTestAttempts = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const { uuids: categoryUuids } = await getEducatorCategoryIds(req.educator.id);
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (categoryUuids.length === 0) {
            return res.status(200).json({ success: true, data: [], pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 } });
        }

        const sessions = await TestSession.findAll({ where: { status: 'completed' }, order: [['created_at', 'DESC']] });
        const scoped = sessions.filter((s) => categoryUuids.includes(s.session_data?.category_uuid));

        const grouped = new Map();
        scoped.forEach((s) => {
            if (!grouped.has(s.user_id)) grouped.set(s.user_id, []);
            grouped.get(s.user_id).push(s);
        });

        let userIds = [...grouped.keys()];
        if (search) {
            const like = `%${search}%`;
            const matchingUsers = await User.findAll({
                where: { uuid: userIds, [Op.or]: [{ username: { [Op.like]: like } }, { email: { [Op.like]: like } }] },
                attributes: ['uuid'],
            });
            const allowed = new Set(matchingUsers.map((u) => u.uuid));
            userIds = userIds.filter((id) => allowed.has(id));
        }

        const users = await User.findAll({ where: { uuid: userIds }, attributes: ['uuid', 'username', 'email'] });
        const userMap = new Map(users.map((u) => [u.uuid, u]));

        let rows = userIds.map((uid) => {
            const userSessions = grouped.get(uid).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const latest = userSessions[0];
            const user = userMap.get(uid);
            return {
                studentUuid: uid,
                studentName: user?.username || null,
                studentEmail: user?.email || null,
                totalAttempts: userSessions.length,
                completedAttempts: userSessions.length,
                latestAttempt: {
                    sessionId: latest.id,
                    categoryName: latest.category_name,
                    percentage: latest.percentage,
                    finalScore: latest.final_score,
                    completedAt: latest.completed_at,
                },
            };
        });

        rows.sort((a, b) => new Date(b.latestAttempt.completedAt || 0) - new Date(a.latestAttempt.completedAt || 0));

        const total = rows.length;
        const paged = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        res.status(200).json({ success: true, data: paged, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } });
    } catch (err) {
        console.error('List test attempts error:', err);
        return next(new ErrorHandler('Failed to fetch test attempts', 500));
    }
};

exports.getStudentTestAttempts = async (req, res, next) => {
    try {
        const { studentUuid } = req.params;
        const { uuids: categoryUuids } = await getEducatorCategoryIds(req.educator.id);

        const user = await User.findOne({ where: { uuid: studentUuid }, attributes: ['uuid', 'username', 'email'] });
        if (!user) return next(new ErrorHandler('Student not found', 404));

        const sessions = await TestSession.findAll({ where: { user_id: studentUuid, status: 'completed' }, order: [['created_at', 'DESC']] });
        const scoped = sessions.filter((s) => categoryUuids.includes(s.session_data?.category_uuid));

        const attempts = scoped.map((s) => ({
            sessionId: s.id,
            categoryName: s.category_name,
            percentage: s.percentage,
            finalScore: s.final_score,
            totalCorrect: s.total_correct,
            totalWrong: s.total_wrong,
            totalQuestions: s.total_questions,
            timeSpentSeconds: s.time_spent_seconds,
            completedAt: s.completed_at,
        }));

        res.status(200).json({
            success: true,
            data: { student: { uuid: user.uuid, name: user.username, email: user.email }, attempts },
        });
    } catch (err) {
        console.error('Get student test attempts error:', err);
        return next(new ErrorHandler('Failed to fetch student test attempts', 500));
    }
};
```

- [ ] **Step 2: Append the routes**

Add to `Viewebit-backend/routes/EducatorRoutes/studentInsightsRoutes.js`, directly below the `/students` route:

```js
router.get('/test-attempts', studentInsightsController.listTestAttempts);
router.get('/test-attempts/:studentUuid', studentInsightsController.getStudentTestAttempts);
```

- [ ] **Step 3: Verify mounting**

With the dev server running (`npm run dev` in `Viewebit-backend`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/educator/test-attempts
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/educator/test-attempts/00000000-0000-0000-0000-000000000000
```
Expected: both `401` (auth-guarded, not `404`).

- [ ] **Step 4: Commit**

```bash
cd "Viewebit-backend" && git add controllers/EducatorController/studentInsightsController.js routes/EducatorRoutes/studentInsightsRoutes.js && git commit -m "Add educator-scoped Test Attempts endpoints"
```

---

### Task 4: Backend — Subscriptions list + stats endpoints

**Files:**
- Modify: `Viewebit-backend/controllers/EducatorController/studentInsightsController.js` (append)
- Modify: `Viewebit-backend/routes/EducatorRoutes/studentInsightsRoutes.js` (append)

**Interfaces:**
- Consumes: `getEducatorCourses` from Task 1.
- Produces: `GET /api/educator/subscriptions` → `{ success, data: SubscriptionRow[], pagination }` where `SubscriptionRow = { id, student: {uuid,name,email}|null, courseTitle: string|null, amountPaid, currency, status, purchaseDate, expiryDate }`. `GET /api/educator/subscriptions/stats` → `{ success, data: { total, active, expired, totalRevenue } }`. Task 9 (frontend) depends on these exact shapes.

- [ ] **Step 1: Append `listSubscriptions` and `getSubscriptionStats` to the controller**

Add to the end of `Viewebit-backend/controllers/EducatorController/studentInsightsController.js`:

```js
exports.listSubscriptions = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search = '', status = 'all' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        const courses = await getEducatorCourses(req.educator.id);
        const testSeriesIdToCourse = new Map(courses.filter((c) => c.test_series_id).map((c) => [c.test_series_id, c]));
        const testSeriesIds = [...testSeriesIdToCourse.keys()];

        if (testSeriesIds.length === 0) {
            return res.status(200).json({ success: true, data: [], pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 } });
        }

        const whereClause = { test_series_id: testSeriesIds };
        if (status !== 'all') whereClause.status = status;

        const includeClause = [{ model: User, as: 'user', attributes: ['uuid', 'username', 'email'], required: false }];
        if (search) {
            includeClause[0].where = { [Op.or]: [{ username: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }] };
            includeClause[0].required = true;
        }

        const { count, rows } = await Subscription.findAndCountAll({
            where: whereClause,
            include: includeClause,
            limit: limitNum,
            offset: (pageNum - 1) * limitNum,
            order: [['purchase_date', 'DESC']],
        });

        const data = rows.map((sub) => {
            const course = testSeriesIdToCourse.get(sub.test_series_id);
            return {
                id: sub.id,
                student: sub.user ? { uuid: sub.user.uuid, name: sub.user.username, email: sub.user.email } : null,
                courseTitle: course?.title || null,
                amountPaid: sub.amount_paid,
                currency: sub.currency,
                status: sub.status,
                purchaseDate: sub.purchase_date,
                expiryDate: sub.expiry_date,
            };
        });

        res.status(200).json({ success: true, data, pagination: { total: count, page: pageNum, limit: limitNum, totalPages: Math.ceil(count / limitNum) } });
    } catch (err) {
        console.error('List subscriptions error:', err);
        return next(new ErrorHandler('Failed to fetch subscriptions', 500));
    }
};

exports.getSubscriptionStats = async (req, res, next) => {
    try {
        const courses = await getEducatorCourses(req.educator.id);
        const testSeriesIds = [...new Set(courses.filter((c) => c.test_series_id).map((c) => c.test_series_id))];

        if (testSeriesIds.length === 0) {
            return res.status(200).json({ success: true, data: { total: 0, active: 0, expired: 0, totalRevenue: 0 } });
        }

        const now = new Date();
        const baseWhere = { test_series_id: testSeriesIds, status: 'completed' };

        const [total, active, totalRevenue] = await Promise.all([
            Subscription.count({ where: baseWhere }),
            Subscription.count({ where: { ...baseWhere, [Op.or]: [{ expiry_date: null }, { expiry_date: { [Op.gt]: now } }] } }),
            Subscription.sum('amount_paid', { where: baseWhere }),
        ]);

        res.status(200).json({ success: true, data: { total, active, expired: total - active, totalRevenue: totalRevenue || 0 } });
    } catch (err) {
        console.error('Get subscription stats error:', err);
        return next(new ErrorHandler('Failed to fetch subscription stats', 500));
    }
};
```

- [ ] **Step 2: Append the routes**

Add to `Viewebit-backend/routes/EducatorRoutes/studentInsightsRoutes.js`, directly below the `/test-attempts/:studentUuid` route:

```js
router.get('/subscriptions', studentInsightsController.listSubscriptions);
router.get('/subscriptions/stats', studentInsightsController.getSubscriptionStats);
```

- [ ] **Step 3: Verify mounting**

With the dev server running:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/educator/subscriptions
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/educator/subscriptions/stats
```
Expected: both `401`.

- [ ] **Step 4: Commit**

```bash
cd "Viewebit-backend" && git add controllers/EducatorController/studentInsightsController.js routes/EducatorRoutes/studentInsightsRoutes.js && git commit -m "Add educator-scoped Subscriptions list and stats endpoints"
```

---

### Task 5: Backend — Grant manual access endpoint

**Files:**
- Modify: `Viewebit-backend/controllers/EducatorController/studentInsightsController.js` (append)
- Modify: `Viewebit-backend/routes/EducatorRoutes/studentInsightsRoutes.js` (append)

**Interfaces:**
- Produces: `POST /api/educator/subscriptions/manual` — body `{ student_email: string, course_uuid: string }` → `{ success, message, data: Subscription }`.

- [ ] **Step 1: Append `createManualSubscription` to the controller**

Add to the end of `Viewebit-backend/controllers/EducatorController/studentInsightsController.js`, and add `const crypto = require('crypto');` to the top of the file alongside the other requires:

```js
exports.createManualSubscription = async (req, res, next) => {
    try {
        const { student_email, course_uuid } = req.body;
        if (!student_email || !course_uuid) {
            return next(new ErrorHandler('student_email and course_uuid are required', 400));
        }

        const course = await Course.findOne({ where: { uuid: course_uuid, educator_id: req.educator.id } });
        if (!course) return next(new ErrorHandler('Course not found or not owned by you', 404));
        if (!course.test_series_id) return next(new ErrorHandler('This course has no linked test series to grant access to', 400));

        const student = await User.findOne({ where: { email: student_email } });
        if (!student) return next(new ErrorHandler('No student found with that email', 404));

        const existing = await Subscription.findOne({
            where: { user_id: student.uuid, test_series_id: course.test_series_id, status: 'completed' },
        });
        if (existing) return next(new ErrorHandler('This student already has access to this course', 400));

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 365);

        const subscription = await Subscription.create({
            user_id: student.uuid,
            test_series_id: course.test_series_id,
            transaction_id: `EDU-GRANT-${crypto.randomUUID()}`,
            payment_method: 'manual_grant',
            amount_paid: 0,
            currency: 'INR',
            status: 'completed',
            purchase_date: new Date(),
            expiry_date: expiryDate,
            metadata: { granted_by_educator_id: req.educator.id, granted_by_educator: true },
        });

        res.status(201).json({ success: true, message: 'Access granted successfully', data: subscription });
    } catch (err) {
        console.error('Create manual subscription error:', err);
        return next(new ErrorHandler('Failed to grant access', 500));
    }
};
```

- [ ] **Step 2: Append the route**

Add to `Viewebit-backend/routes/EducatorRoutes/studentInsightsRoutes.js`, directly below `/subscriptions/stats`:

```js
router.post('/subscriptions/manual', studentInsightsController.createManualSubscription);
```

- [ ] **Step 3: Verify mounting**

With the dev server running:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/educator/subscriptions/manual -H "Content-Type: application/json" -d '{}'
```
Expected: `401` (auth-guarded).

- [ ] **Step 4: Commit**

```bash
cd "Viewebit-backend" && git add controllers/EducatorController/studentInsightsController.js routes/EducatorRoutes/studentInsightsRoutes.js && git commit -m "Add educator manual-grant-access endpoint"
```

---

### Task 6: Frontend — types and service files

**Files:**
- Modify: `Viewebit-EducatorPanel/src/types/index.ts` (append)
- Create: `Viewebit-EducatorPanel/src/services/students.ts`
- Create: `Viewebit-EducatorPanel/src/services/testAttempts.ts`
- Create: `Viewebit-EducatorPanel/src/services/subscriptions.ts`

**Interfaces:**
- Consumes: backend response shapes from Tasks 2–5.
- Produces: `studentsService.getStudents`, `testAttemptsService.getTestAttempts`, `testAttemptsService.getStudentTestAttempts`, `subscriptionsService.getSubscriptions`, `subscriptionsService.getStats`, `subscriptionsService.grantAccess` — Tasks 7–9 (pages) call these by these exact names.

- [ ] **Step 1: Append shared types**

Add to the end of `Viewebit-EducatorPanel/src/types/index.ts`:

```ts
// Student insights types
export type AccessType = 'paid' | 'free' | 'quiz';

export interface StudentRow {
  uuid: string;
  name: string | null;
  email: string | null;
  courses: string[];
  accessType: AccessType;
  lastActivity: string | null;
  quizAttempts: number;
}

export interface TestAttemptSummary {
  studentUuid: string;
  studentName: string | null;
  studentEmail: string | null;
  totalAttempts: number;
  completedAttempts: number;
  latestAttempt: {
    sessionId: string;
    categoryName: string | null;
    percentage: number | null;
    finalScore: number | null;
    completedAt: string | null;
  };
}

export interface TestAttemptDetail {
  sessionId: string;
  categoryName: string | null;
  percentage: number | null;
  finalScore: number | null;
  totalCorrect: number;
  totalWrong: number;
  totalQuestions: number;
  timeSpentSeconds: number | null;
  completedAt: string | null;
}

export type SubscriptionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface SubscriptionRow {
  id: string;
  student: { uuid: string; name: string | null; email: string | null } | null;
  courseTitle: string | null;
  amountPaid: number;
  currency: string;
  status: SubscriptionStatus;
  purchaseDate: string;
  expiryDate: string | null;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

- [ ] **Step 2: Create `services/students.ts`**

```ts
// Viewebit-EducatorPanel/src/services/students.ts
import api from './api';
import { StudentRow, Pagination } from '../types';

export const studentsService = {
  getStudents: async (params?: {
    search?: string;
    access_type?: string;
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data: StudentRow[]; pagination: Pagination }> => {
    const response = await api.get('/educator/students', { params });
    return response.data;
  },
};
```

- [ ] **Step 3: Create `services/testAttempts.ts`**

```ts
// Viewebit-EducatorPanel/src/services/testAttempts.ts
import api from './api';
import { TestAttemptSummary, TestAttemptDetail, Pagination } from '../types';

export const testAttemptsService = {
  getTestAttempts: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data: TestAttemptSummary[]; pagination: Pagination }> => {
    const response = await api.get('/educator/test-attempts', { params });
    return response.data;
  },

  getStudentTestAttempts: async (
    studentUuid: string
  ): Promise<{ success: boolean; data: { student: { uuid: string; name: string | null; email: string | null }; attempts: TestAttemptDetail[] } }> => {
    const response = await api.get(`/educator/test-attempts/${studentUuid}`);
    return response.data;
  },
};
```

- [ ] **Step 4: Create `services/subscriptions.ts`**

```ts
// Viewebit-EducatorPanel/src/services/subscriptions.ts
import api from './api';
import { SubscriptionRow, Pagination } from '../types';

export const subscriptionsService = {
  getSubscriptions: async (params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data: SubscriptionRow[]; pagination: Pagination }> => {
    const response = await api.get('/educator/subscriptions', { params });
    return response.data;
  },

  getStats: async (): Promise<{ success: boolean; data: { total: number; active: number; expired: number; totalRevenue: number } }> => {
    const response = await api.get('/educator/subscriptions/stats');
    return response.data;
  },

  grantAccess: async (student_email: string, course_uuid: string) => {
    const response = await api.post('/educator/subscriptions/manual', { student_email, course_uuid });
    return response.data;
  },
};
```

- [ ] **Step 5: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep -E "types/index|services/students|services/testAttempts|services/subscriptions"`
Expected: no output (no errors in these 4 files).

- [ ] **Step 6: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/types/index.ts src/services/students.ts src/services/testAttempts.ts src/services/subscriptions.ts && git commit -m "Add types and service wrappers for student insights"
```

---

### Task 7: Frontend — Students page

**Files:**
- Create: `Viewebit-EducatorPanel/src/pages/students/StudentsPage.tsx`

**Interfaces:**
- Consumes: `studentsService.getStudents` from Task 6.

- [ ] **Step 1: Write the page**

```tsx
// Viewebit-EducatorPanel/src/pages/students/StudentsPage.tsx
import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { studentsService } from '../../services/students';
import { StudentRow, AccessType } from '../../types';

const ACCESS_BADGE: Record<AccessType, string> = {
  paid: 'bg-green-100 text-green-800',
  free: 'bg-blue-100 text-blue-800',
  quiz: 'bg-purple-100 text-purple-800',
};
const ACCESS_LABEL: Record<AccessType, string> = {
  paid: 'Paid',
  free: 'Free',
  quiz: 'Quiz only',
};

export const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [accessType, setAccessType] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => {
      load();
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, accessType, page]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await studentsService.getStudents({ search, access_type: accessType, page, limit: 20 });
      setStudents(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      toast.error('Failed to load students');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <p className="text-gray-600">Everyone engaging with your courses and quizzes</p>
      </div>

      <div className="card p-4 flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          placeholder="Search by name or email"
          className="input-field flex-1"
        />
        <select
          value={accessType}
          onChange={(e) => { setPage(1); setAccessType(e.target.value); }}
          className="input-field w-48"
        >
          <option value="all">All access types</option>
          <option value="paid">Paid</option>
          <option value="free">Free</option>
          <option value="quiz">Quiz only</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No students yet</h3>
            <p className="text-gray-600">Once students engage with your courses or quizzes, they'll show up here.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Courses</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Access</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quiz Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.map((s) => (
                <tr key={s.uuid}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{s.name || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{s.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.courses.length > 0 ? s.courses.join(', ') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACCESS_BADGE[s.accessType]}`}>
                      {ACCESS_LABEL[s.accessType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {s.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.quizAttempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="px-3 py-2 text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep "StudentsPage"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/pages/students/StudentsPage.tsx && git commit -m "Add Students page"
```

---

### Task 8: Frontend — Test Attempts page with drill-down modal

**Files:**
- Create: `Viewebit-EducatorPanel/src/pages/test-attempts/TestAttemptsPage.tsx`

**Interfaces:**
- Consumes: `testAttemptsService.getTestAttempts`, `testAttemptsService.getStudentTestAttempts` from Task 6.

- [ ] **Step 1: Write the page**

```tsx
// Viewebit-EducatorPanel/src/pages/test-attempts/TestAttemptsPage.tsx
import React, { useEffect, useState } from 'react';
import { Activity, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { testAttemptsService } from '../../services/testAttempts';
import { TestAttemptSummary, TestAttemptDetail } from '../../types';

interface DrillDownState {
  isOpen: boolean;
  loading: boolean;
  student: { uuid: string; name: string | null; email: string | null } | null;
  attempts: TestAttemptDetail[];
}

export const TestAttemptsPage: React.FC = () => {
  const [rows, setRows] = useState<TestAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [drillDown, setDrillDown] = useState<DrillDownState>({ isOpen: false, loading: false, student: null, attempts: [] });

  useEffect(() => {
    const handle = setTimeout(() => { load(); }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await testAttemptsService.getTestAttempts({ search, page, limit: 20 });
      setRows(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      toast.error('Failed to load test attempts');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const openDrillDown = async (studentUuid: string) => {
    setDrillDown({ isOpen: true, loading: true, student: null, attempts: [] });
    try {
      const response = await testAttemptsService.getStudentTestAttempts(studentUuid);
      setDrillDown({ isOpen: true, loading: false, student: response.data.student, attempts: response.data.attempts });
    } catch (error) {
      toast.error('Failed to load attempt history');
      setDrillDown({ isOpen: false, loading: false, student: null, attempts: [] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Test Attempts</h1>
        <p className="text-gray-600">Quiz activity across your own quiz categories</p>
      </div>

      <div className="card p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          placeholder="Search by name or email"
          className="input-field w-full"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No attempts yet</h3>
            <p className="text-gray-600">Once students attempt your quizzes, their activity will show up here.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Attempts</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((r) => (
                <tr key={r.studentUuid} className="cursor-pointer hover:bg-gray-50" onClick={() => openDrillDown(r.studentUuid)}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{r.studentName || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{r.studentEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.totalAttempts}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.latestAttempt.categoryName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.latestAttempt.percentage != null ? `${r.latestAttempt.percentage}%` : '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {r.latestAttempt.completedAt ? new Date(r.latestAttempt.completedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="px-3 py-2 text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {drillDown.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{drillDown.student?.name || 'Attempt History'}</h2>
                <p className="text-sm text-gray-500">{drillDown.student?.email}</p>
              </div>
              <button onClick={() => setDrillDown({ isOpen: false, loading: false, student: null, attempts: [] })} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {drillDown.loading ? (
                <CardSkeleton />
              ) : drillDown.attempts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No attempts found.</p>
              ) : (
                <div className="space-y-3">
                  {drillDown.attempts.map((a) => (
                    <div key={a.sessionId} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">{a.categoryName || 'Quiz'}</span>
                        <span className="text-sm text-gray-500">{a.completedAt ? new Date(a.completedAt).toLocaleString() : '—'}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Score: {a.finalScore ?? '—'} · {a.percentage != null ? `${a.percentage}%` : '—'} · Correct {a.totalCorrect}/{a.totalQuestions}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep "TestAttemptsPage"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/pages/test-attempts/TestAttemptsPage.tsx && git commit -m "Add Test Attempts page with drill-down modal"
```

---

### Task 9: Frontend — Subscriptions page with Grant Access modal

**Files:**
- Create: `Viewebit-EducatorPanel/src/pages/subscriptions/SubscriptionsPage.tsx`

**Interfaces:**
- Consumes: `subscriptionsService.getSubscriptions`, `subscriptionsService.getStats`, `subscriptionsService.grantAccess` from Task 6; `coursesService.getMyCourses` (existing, from `services/courses.ts`).

- [ ] **Step 1: Write the page**

```tsx
// Viewebit-EducatorPanel/src/pages/subscriptions/SubscriptionsPage.tsx
import React, { useEffect, useState } from 'react';
import { CreditCard, CheckCircle, XCircle, DollarSign, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { subscriptionsService } from '../../services/subscriptions';
import { coursesService } from '../../services/courses';
import { SubscriptionRow, Course } from '../../types';

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-700',
};

const GrantAccessModal: React.FC<{ isOpen: boolean; onClose: () => void; onGranted: () => void }> = ({ isOpen, onClose, onGranted }) => {
  const [email, setEmail] = useState('');
  const [courseUuid, setCourseUuid] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      coursesService.getMyCourses().then((res) => setCourses((res.data || []).filter((c) => c.test_series_id))).catch(() => setCourses([]));
      setEmail('');
      setCourseUuid('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !courseUuid) {
      toast.error('Student email and course are required');
      return;
    }
    setLoading(true);
    try {
      await subscriptionsService.grantAccess(email.trim(), courseUuid);
      toast.success('Access granted');
      onGranted();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to grant access');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Grant Access</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course *</label>
            <select value={courseUuid} onChange={(e) => setCourseUuid(e.target.value)} className="input-field w-full" required>
              <option value="">Select a course</option>
              {courses.map((c) => <option key={c.uuid} value={c.uuid}>{c.title}</option>)}
            </select>
            {courses.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">None of your courses are linked to a test series yet — access can only be granted for courses with a linked test series.</p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>{loading ? 'Granting...' : 'Grant Access'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const SubscriptionsPage: React.FC = () => {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showGrantModal, setShowGrantModal] = useState(false);

  useEffect(() => {
    subscriptionsService.getStats().then((res) => setStats(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => { load(); }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await subscriptionsService.getSubscriptions({ search, status, page, limit: 20 });
      setRows(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      toast.error('Failed to load subscriptions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = () => {
    load();
    subscriptionsService.getStats().then((res) => setStats(res.data)).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-gray-600">Who has paid access to your courses</p>
        </div>
        <button onClick={() => setShowGrantModal(true)} className="btn-primary inline-flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Grant Access
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard title="Active" value={stats.active} icon={CheckCircle} color="green" />
        <StatsCard title="Expired" value={stats.expired} icon={XCircle} color="red" />
        <StatsCard title="Total Revenue" value={`₹${stats.totalRevenue}`} icon={DollarSign} color="blue" />
      </div>

      <div className="card p-4 flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          placeholder="Search by student name or email"
          className="input-field flex-1"
        />
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="input-field w-48">
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No subscriptions yet</h3>
            <p className="text-gray-600">Once students purchase access to your courses, they'll show up here.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchased</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{r.student?.name || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{r.student?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.courseTitle || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.currency} {r.amountPaid}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(r.purchaseDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="px-3 py-2 text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      <GrantAccessModal isOpen={showGrantModal} onClose={() => setShowGrantModal(false)} onGranted={refreshAll} />
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep "SubscriptionsPage"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/pages/subscriptions/SubscriptionsPage.tsx && git commit -m "Add Subscriptions page with Grant Access modal"
```

---

### Task 10: Frontend — wire routes and navigation

**Files:**
- Modify: `Viewebit-EducatorPanel/src/App.tsx`
- Modify: `Viewebit-EducatorPanel/src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `StudentsPage`, `TestAttemptsPage`, `SubscriptionsPage` from Tasks 7–9.

- [ ] **Step 1: Add imports and routes to `App.tsx`**

Add these imports directly below the existing `import { PdfLibraryPage } from './pages/pdfs/PdfLibraryPage';` line:
```tsx
import { StudentsPage } from './pages/students/StudentsPage';
import { TestAttemptsPage } from './pages/test-attempts/TestAttemptsPage';
import { SubscriptionsPage } from './pages/subscriptions/SubscriptionsPage';
```

Add these routes directly below the existing `<Route path="pdfs" ...>` line, before the `announcements` route:
```tsx
<Route path="students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
<Route path="test-attempts" element={<ProtectedRoute><TestAttemptsPage /></ProtectedRoute>} />
<Route path="subscriptions" element={<ProtectedRoute><SubscriptionsPage /></ProtectedRoute>} />
```

- [ ] **Step 2: Add nav entries to `Sidebar.tsx`**

Change the icon imports at the top from:
```tsx
import {
  BookOpen,
  CheckSquare,
  ClipboardList,
  Home,
  LogOut,
  MessageSquare,
  Video,
  HelpCircle,
  FileText,
} from 'lucide-react';
```
to:
```tsx
import {
  BookOpen,
  CheckSquare,
  ClipboardList,
  Home,
  LogOut,
  MessageSquare,
  Video,
  HelpCircle,
  FileText,
  Users,
  Activity,
  CreditCard,
} from 'lucide-react';
```

Change the `navigation` array from:
```tsx
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'My Courses', href: '/courses', icon: BookOpen },
  { name: 'Quiz Categories', href: '/quizzes', icon: HelpCircle },
  { name: 'PDF Library', href: '/pdfs', icon: FileText },
  { name: 'Assignments & Quizzes', href: '/assignments', icon: ClipboardList },
  { name: 'Grading & Attendance', href: '/grading', icon: CheckSquare },
  { name: 'Live Sessions', href: '/live-sessions', icon: Video },
  { name: 'Announcements & Q&A', href: '/announcements', icon: MessageSquare },
];
```
to:
```tsx
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'My Courses', href: '/courses', icon: BookOpen },
  { name: 'Students', href: '/students', icon: Users },
  { name: 'Test Attempts', href: '/test-attempts', icon: Activity },
  { name: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
  { name: 'Quiz Categories', href: '/quizzes', icon: HelpCircle },
  { name: 'PDF Library', href: '/pdfs', icon: FileText },
  { name: 'Assignments & Quizzes', href: '/assignments', icon: ClipboardList },
  { name: 'Grading & Attendance', href: '/grading', icon: CheckSquare },
  { name: 'Live Sessions', href: '/live-sessions', icon: Video },
  { name: 'Announcements & Q&A', href: '/announcements', icon: MessageSquare },
];
```

- [ ] **Step 3: Verify typecheck and build**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep -E "App\.tsx|Sidebar\.tsx"`
Expected: no output.

Run: `cd "Viewebit-EducatorPanel" && npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/App.tsx src/components/layout/Sidebar.tsx && git commit -m "Wire Students/Test Attempts/Subscriptions into routing and navigation"
```

---

### Task 11: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start both dev servers**

```bash
cd "Viewebit-backend" && npm run dev
cd "Viewebit-EducatorPanel" && npm run dev
```

- [ ] **Step 2: Log in as a real educator in the browser and click through**

1. Open the Educator Panel, log in, click **Students** in the sidebar — confirm the page loads (empty state is fine if this educator has no engaged students yet).
2. Click **Test Attempts** — confirm the page loads; if there's at least one row, click it and confirm the drill-down modal opens with attempt details.
3. Click **Subscriptions** — confirm the stat tiles and table load.
4. Click **Grant Access**, pick one of your own courses that has a linked test series, enter a real student's email, submit — confirm a success toast, and confirm the new row appears in the Subscriptions table with amount `0`.
5. Log in as that student (in `Viewebit-web` or `viewebit-app`) and confirm they now have access to that course (`hasAccess: true` when opening it).

- [ ] **Step 3: Confirm scoping is correct**

If a second educator account exists with their own course/quiz category: confirm their students/attempts/subscriptions do **not** appear in the first educator's pages, and vice versa.

- [ ] **Step 4: Final commit (if any manual fixes were needed during verification)**

```bash
cd "Viewebit-backend" && git status
cd "Viewebit-EducatorPanel" && git status
```
If either has uncommitted changes from fixes made during verification, commit them with a descriptive message.
