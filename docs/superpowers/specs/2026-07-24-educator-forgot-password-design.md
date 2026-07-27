# Educator Panel: Forgot Password

## Context

The Educator Panel login screen (`Viewebit-EducatorPanel`) has no way to recover a forgotten password today — login is email+password followed by a mandatory 6-digit OTP (2FA), but there is no "forgot password" link or backend endpoint anywhere in the educator auth surface. The only existing precedent in the codebase is the student (`User`) forgot-password flow (`controllers/AuthController/authController.js`), which has a real security gap: its `resetPassword` endpoint never actually checks the OTP before overwriting the password — it just trusts whoever calls it with an email. This feature adds a proper, OTP-verified forgot-password flow for educators, deliberately not copying that gap.

## Flow

Three sequential screens, each backed by its own endpoint, mirroring the existing login→OTP→JWT pattern already used for educator login:

1. **Enter email** → `POST /api/educator/forgot-password { email }` → OTP emailed.
2. **Enter 6-digit OTP** → `POST /api/educator/verify-reset-otp { email, otp }` → returns a short-lived opaque `resetToken`.
3. **Enter new password (+ confirm)** → `POST /api/educator/reset-password { email, resetToken, newPassword }` → password updated, any existing logged-in session for that educator is force-logged-out.

## Backend (`Viewebit-backend`)

### Data model
New nullable columns on `educators` (via a new idempotent migration, `describeTable`-guarded like the rest of this codebase's recent migrations):
- `reset_otp` (STRING)
- `reset_otp_expiry` (DATE)
- `reset_token` (STRING)
- `reset_token_expiry` (DATE)

Deliberately separate from the existing `otp`/`otpExpiry` columns (used for login 2FA) so an in-flight login OTP and a password-reset OTP never collide or invalidate each other.

`models/Educator.js` gets these 4 attributes added, matching the style of the existing `otp`/`otpExpiry` declarations.

### Endpoints
All three added to `controllers/EducatorController/educatorAuthController.js` and routed (public, unauthenticated) in `routes/EducatorRoutes/educatorAuthRoutes.js`, following the existing kebab-case naming convention (`verify-otp`, `resend-otp`):

**`POST /api/educator/forgot-password`**
- Body: `{ email }`.
- Looks up `Educator.findOne({ where: { email } })`.
- Always responds `{ success: true, message: "If that email is registered, a code has been sent." }` regardless of whether a match was found, to avoid email enumeration.
- If a match exists: generate a 6-digit OTP via the existing `generate6DigitOTP()` helper, set `reset_otp_expiry = now + 10 minutes`, save both to the row, and email it via the existing `sendMail` util (same `smtp.gmail.com` / `NODMAILER_EMAIL` transport already used for login OTP), subject `"Viewebit Educator Panel - Password Reset Code"`.

**`POST /api/educator/verify-reset-otp`**
- Body: `{ email, otp }`.
- Looks up the educator, validates `reset_otp` matches (string-compare, same convention as existing `verifyOTP`) and `reset_otp_expiry` hasn't passed. On failure: 400 `"Invalid or expired code"`.
- On success: generate `reset_token = crypto.randomBytes(32).toString('hex')`, set `reset_token_expiry = now + 10 minutes`, clear `reset_otp`/`reset_otp_expiry` (single-use), save.
- Response: `{ success: true, data: { resetToken } }`.

**`POST /api/educator/reset-password`**
- Body: `{ email, resetToken, newPassword }` (`newPassword` min 6 chars, same rule already enforced client-side at login).
- Looks up the educator, validates `reset_token` matches and `reset_token_expiry` hasn't passed. On failure: 400 `"Reset link expired, please try again"`.
- On success: `password = bcrypt.hash(newPassword, 10)`, clear `reset_token`/`reset_token_expiry`, and clear `current_session_id` (force-logs-out any existing active session, standard practice after a password reset).
- Response: `{ success: true, message: "Password reset successfully" }`.

### Out of scope
No new server-side rate-limiting infrastructure — matches this codebase's existing convention (login-OTP resend is only cooldown-gated client-side today, no backend throttle either).

## Frontend (`Viewebit-EducatorPanel`)

There's no router for the unauthenticated state today — `AuthWrapper` conditionally swaps `LoginForm` ↔ `OTPVerificationForm` via local component-swap state, not routes. This feature follows the same pattern rather than introducing new routes.

- **`LoginForm.tsx`**: add a "Forgot password?" link under the password field, styled like the existing "Need help? Contact your institution admin" helper text.
- **`AuthWrapper`**: add a new step alongside the existing `showOTPScreen`, cycling through 3 new components. Each has a "Back to login" / cancel affordance that resets the wrapper back to `LoginForm`.
  - **`ForgotPasswordForm.tsx`** — email field (zod email validation) → `authService.forgotPassword({ email })` → advances to the OTP step. Shows the same generic "if registered..." message regardless of outcome.
  - **`ResetOTPForm.tsx`** — 6-digit OTP input, reusing `OTPVerificationForm`'s existing UX conventions (10-minute countdown, 60-second resend cooldown, auto-submit at 6 digits) → `authService.verifyResetOTP({ email, otp })` → holds the returned `resetToken` in local state → advances to the reset step. Resend calls `forgot-password` again (issues a fresh OTP).
  - **`ResetNewPasswordForm.tsx`** — new password + confirm-password fields (zod: min 6 chars, must match) → `authService.resetPassword({ email, resetToken, newPassword })` → on success, shows a confirmation and returns to `LoginForm` so they can log in with the new password.
- **`src/services/auth.ts`**: add `forgotPassword`, `verifyResetOTP`, `resetPassword` methods mirroring the existing `login`/`verifyOTP`/`resendOTP` shape.

## Error Handling

- **Email enumeration**: `forgot-password` always returns the same generic success message; only later steps (which require having actually received the emailed OTP) reveal anything.
- **Expired/wrong OTP**: clear 400 "Invalid or expired code"; user can retry or hit resend.
- **Expired/invalid reset token**: 400 "Reset link expired, please try again"; frontend routes them back to `ForgotPasswordForm`.
- **Session invalidation**: a successful reset clears `current_session_id`, forcing any other logged-in session for that educator to re-authenticate.
- **Inactive accounts** (`isActive: false`): reset is still allowed to complete — harmless, since an inactive account still can't log in afterward regardless.

## Testing/Verification

Neither repo has an automated test framework (existing convention). Verification:
- **Backend**: `node -e` require-checks on the new migration/controller/model changes; curl tests against a running dev server for all 3 new endpoints covering happy path, invalid OTP, and expired/invalid token.
- **Frontend**: `npx tsc --noEmit` and `npm run build` must both pass; manual click-through of the full email → OTP → new-password flow in the browser if a dev server can be run.
