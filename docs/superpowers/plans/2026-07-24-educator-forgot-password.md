# Educator Forgot Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Forgot password?" link to the Educator Panel login screen backed by a 3-step email → OTP → new-password flow, closing the security gap in the existing student forgot-password flow (which never actually checks the OTP before changing the password).

**Architecture:** Three new backend endpoints on `controllers/EducatorController/educatorAuthController.js` (`forgot-password`, `verify-reset-otp`, `reset-password`), using 4 new dedicated columns on `Educator` (`reset_otp`, `reset_otp_expiry`, `reset_token`, `reset_token_expiry`) kept fully separate from the existing login-OTP columns. The OTP step issues a short-lived opaque `resetToken` that the final step requires — mirroring the existing login → OTP → JWT pattern already used for educator login, and matching the existing "flow" this codebase already knows how to test (curl 401/400 checks, no automated test framework in either repo). On the frontend, three new components (`ForgotPasswordForm`, `ResetOTPForm`, `ResetNewPasswordForm`) are wired into `LoginForm.tsx`'s existing screen-swap state pattern (the same pattern that already swaps in `OTPVerificationForm`), not a new route — there's no router for the unauthenticated state today.

**Tech Stack:** Node/Express 5 + Sequelize 6 + MySQL + bcryptjs + Node's builtin `crypto` (backend); React 19 + TypeScript + react-hook-form + zod + lucide-react + react-hot-toast (Viewebit-EducatorPanel). No test framework exists in either repo (confirmed: `Viewebit-backend`'s `npm test` is a stub, `Viewebit-EducatorPanel` has no test script). This plan follows the established convention: each backend task's "test" step is a `node -e` require-check plus a `curl` command with an exact expected status/response; each frontend task's is `npx tsc --noEmit` plus a manual click-through.

## Global Constraints

- All 3 new backend endpoints are public routes (no `educatorAuth` middleware) — a locked-out educator has no Bearer token to send, matching how `login`/`verify-otp`/`resend-otp` are already public.
- `forgot-password` always returns the identical success message regardless of whether the email is registered (prevents email enumeration) — only later steps (which require having actually received the emailed OTP) reveal anything.
- Reset fields (`reset_otp`, `reset_otp_expiry`, `reset_token`, `reset_token_expiry`) are entirely separate columns from login's `otp`/`otpExpiry` — a password reset must never invalidate or be invalidated by an in-flight login OTP.
- OTP is 6 digits with a 10-minute expiry; reset token is a `crypto.randomBytes(32).toString('hex')` string with its own 10-minute expiry — matching the existing login-OTP timing constants (`generate6DigitOTP()`, `10 * 60 * 1000`).
- A successful password reset clears `current_session_id`, force-logging-out any device currently logged in as that educator (standard practice after a credential change).
- Password minimum length is 6 characters, matching the existing login form's `zod` rule (`z.string().min(6, ...)`) — no new password policy introduced.
- No new npm dependencies in either repo — reuses `bcryptjs`, `jsonwebtoken`, `crypto` (builtin), `nodemailer` via the existing `utils/verifyEmail.js` (backend); `zod`, `react-hook-form`, `lucide-react`, `react-hot-toast` (frontend), matching every existing auth component.
- No new server-side rate limiting — matches this codebase's existing convention (login-OTP resend is only cooldown-gated client-side today, no backend throttle either).

---

### Task 1: Backend — reset-password columns on Educator

**Files:**
- Create: `Viewebit-backend/migrations/20260724000005-add-reset-password-fields-to-educators.js`
- Modify: `Viewebit-backend/models/Educator.js:94-97` (insert after `otpExpiry`, before `current_session_id`)

**Interfaces:**
- Produces: `Educator` rows gain `reset_otp: string|null`, `reset_otp_expiry: Date|null`, `reset_token: string|null`, `reset_token_expiry: Date|null`. Tasks 2-4 read/write these exact column names via the Sequelize model.

- [ ] **Step 1: Write the migration**

```js
// Viewebit-backend/migrations/20260724000005-add-reset-password-fields-to-educators.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('educators');

    const columns = {
      reset_otp: { type: Sequelize.STRING, allowNull: true },
      reset_otp_expiry: { type: Sequelize.DATE, allowNull: true },
      reset_token: { type: Sequelize.STRING, allowNull: true },
      reset_token_expiry: { type: Sequelize.DATE, allowNull: true }
    };

    for (const [name, definition] of Object.entries(columns)) {
      if (!table[name]) {
        await queryInterface.addColumn('educators', name, definition);
      }
    }
  },

  async down(queryInterface) {
    const columns = ['reset_otp', 'reset_otp_expiry', 'reset_token', 'reset_token_expiry'];
    const table = await queryInterface.describeTable('educators');
    for (const name of columns) {
      if (table[name]) {
        await queryInterface.removeColumn('educators', name);
      }
    }
  }
};
```

- [ ] **Step 2: Add the columns to the `Educator` model**

In `Viewebit-backend/models/Educator.js`, find:
```js
    otpExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    current_session_id: {
```
Replace with:
```js
    otpExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reset_otp: {
      type: DataTypes.STRING,
      allowNull: true
    },
    reset_otp_expiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reset_token: {
      type: DataTypes.STRING,
      allowNull: true
    },
    reset_token_expiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    current_session_id: {
```

- [ ] **Step 3: Verify it loads cleanly**

Run: `cd "Viewebit-backend" && node -e "require('./migrations/20260724000005-add-reset-password-fields-to-educators.js'); require('./models'); console.log('OK');"`
Expected: `OK` (no thrown error).

- [ ] **Step 4: Commit**

```bash
cd "Viewebit-backend" && git add migrations/20260724000005-add-reset-password-fields-to-educators.js models/Educator.js && git commit -m "Add reset-password fields to Educator"
```

---

### Task 2: Backend — `forgot-password` endpoint

**Files:**
- Modify: `Viewebit-backend/controllers/EducatorController/educatorAuthController.js` (append)
- Modify: `Viewebit-backend/routes/EducatorRoutes/educatorAuthRoutes.js` (append)

**Interfaces:**
- Consumes: `Educator` model's `reset_otp`/`reset_otp_expiry` columns from Task 1.
- Produces: `POST /api/educator/forgot-password` → always `{ success: true, message: "If that email is registered, a code has been sent." }`. Task 3 relies on `reset_otp`/`reset_otp_expiry` being populated by this endpoint.

- [ ] **Step 1: Append `forgotPassword` to the controller**

Add to the end of `Viewebit-backend/controllers/EducatorController/educatorAuthController.js`:

```js
// Forgot password - Step 1: Send reset OTP if the email is registered
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        const educator = await Educator.findOne({ where: { email } });

        if (educator) {
            const otp = generate6DigitOTP();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

            educator.reset_otp = otp.toString();
            educator.reset_otp_expiry = otpExpiry;
            await educator.save();

            try {
                await sendMail({
                    receiver: email,
                    subject: `Viewebit Educator Panel - Password Reset Code`,
                    content: 'content',
                    service: null,
                    host: "smtp.gmail.com",
                    htmlContent: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f8;">
                      <div style="max-width: 500px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
                        <p>Hi <strong>${educator.name}</strong>,</p>
                        <p>Use the following code to reset your password:</p>
                        <h1 style="text-align: center; color: #7C3AED; letter-spacing: 4px; background-color: #f0f0f0; padding: 15px; border-radius: 8px;">${otp}</h1>
                        <p style="color: #666;">This code is valid for <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
                        <br/>
                        <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; ${new Date().getFullYear()} Viewebit Academy - Educator Panel</p>
                      </div>
                    </div>
                  `,
                    cc: null,
                    bcc: null
                });
            } catch (error) {
                console.error("Error sending Educator password reset email:", error);
                return next(new ErrorHandler("Failed to send reset code. Please try again.", 500));
            }
        }

        res.status(200).json({
            success: true,
            message: 'If that email is registered, a code has been sent.'
        });
    } catch (err) {
        console.error('Educator forgot password error:', err);
        return next(new ErrorHandler('Failed to process request', 500));
    }
};
```

- [ ] **Step 2: Append the route**

In `Viewebit-backend/routes/EducatorRoutes/educatorAuthRoutes.js`, find:
```js
router.post('/resend-otp', educatorAuthController.resendOTP);
```
Add directly below it:
```js
router.post('/forgot-password', educatorAuthController.forgotPassword);
```

- [ ] **Step 3: Verify the backend loads cleanly**

Run: `cd "Viewebit-backend" && node -e "require('./models'); require('./routes/index'); console.log('ALL OK');"`
Expected: `ALL OK`.

- [ ] **Step 4: Verify the endpoint responds correctly for both a real and a fake email**

With the dev server running (`npm run dev` in `Viewebit-backend`), pick any seeded educator email (or use a fake one — the response is identical either way):
```bash
curl -s -X POST http://localhost:3000/api/educator/forgot-password -H "Content-Type: application/json" -d '{"email":"nonexistent-educator@example.com"}'
```
Expected: `{"success":true,"message":"If that email is registered, a code has been sent."}` — same shape for a real registered email (and, if a real email was used, an email arrives).

- [ ] **Step 5: Commit**

```bash
cd "Viewebit-backend" && git add controllers/EducatorController/educatorAuthController.js routes/EducatorRoutes/educatorAuthRoutes.js && git commit -m "Add educator forgot-password endpoint"
```

---

### Task 3: Backend — `verify-reset-otp` endpoint

**Files:**
- Modify: `Viewebit-backend/controllers/EducatorController/educatorAuthController.js` (append)
- Modify: `Viewebit-backend/routes/EducatorRoutes/educatorAuthRoutes.js` (append)

**Interfaces:**
- Consumes: `reset_otp`/`reset_otp_expiry` populated by Task 2.
- Produces: `POST /api/educator/verify-reset-otp` → `{ success: true, data: { resetToken: string } }` on success, or 400/404 error. Populates `reset_token`/`reset_token_expiry`, which Task 4 consumes.

- [ ] **Step 1: Append `verifyResetOTP` to the controller**

Add to the end of `Viewebit-backend/controllers/EducatorController/educatorAuthController.js`:

```js
// Forgot password - Step 2: Verify OTP and issue a short-lived reset token
exports.verifyResetOTP = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        const educator = await Educator.findOne({ where: { email } });
        if (!educator) return next(new ErrorHandler('Invalid or expired code', 400));

        if (!educator.reset_otp || !educator.reset_otp_expiry) {
            return next(new ErrorHandler('Invalid or expired code', 400));
        }

        if (new Date() > new Date(educator.reset_otp_expiry)) {
            educator.reset_otp = null;
            educator.reset_otp_expiry = null;
            await educator.save();
            return next(new ErrorHandler('Invalid or expired code', 400));
        }

        if (educator.reset_otp !== otp.toString()) {
            return next(new ErrorHandler('Invalid or expired code', 400));
        }

        const resetToken = require('crypto').randomBytes(32).toString('hex');
        educator.reset_otp = null;
        educator.reset_otp_expiry = null;
        educator.reset_token = resetToken;
        educator.reset_token_expiry = new Date(Date.now() + 10 * 60 * 1000);
        await educator.save();

        res.status(200).json({
            success: true,
            data: { resetToken }
        });
    } catch (err) {
        console.error('Educator verify reset OTP error:', err);
        return next(new ErrorHandler('Failed to verify code', 500));
    }
};
```

- [ ] **Step 2: Append the route**

In `Viewebit-backend/routes/EducatorRoutes/educatorAuthRoutes.js`, find:
```js
router.post('/forgot-password', educatorAuthController.forgotPassword);
```
Add directly below it:
```js
router.post('/verify-reset-otp', educatorAuthController.verifyResetOTP);
```

- [ ] **Step 3: Verify the backend loads cleanly**

Run: `cd "Viewebit-backend" && node -e "require('./models'); require('./routes/index'); console.log('ALL OK');"`
Expected: `ALL OK`.

- [ ] **Step 4: Verify invalid-OTP rejection**

With the dev server running:
```bash
curl -s -X POST http://localhost:3000/api/educator/verify-reset-otp -H "Content-Type: application/json" -d '{"email":"nonexistent-educator@example.com","otp":"000000"}'
```
Expected: 400 status, `{"success":false,"message":"Invalid or expired code",...}`. (Full happy-path — real OTP → real `resetToken` — is verified end-to-end in Task 8's manual click-through, since it requires reading a real email.)

- [ ] **Step 5: Commit**

```bash
cd "Viewebit-backend" && git add controllers/EducatorController/educatorAuthController.js routes/EducatorRoutes/educatorAuthRoutes.js && git commit -m "Add educator verify-reset-otp endpoint"
```

---

### Task 4: Backend — `reset-password` endpoint

**Files:**
- Modify: `Viewebit-backend/controllers/EducatorController/educatorAuthController.js` (append)
- Modify: `Viewebit-backend/routes/EducatorRoutes/educatorAuthRoutes.js` (append)

**Interfaces:**
- Consumes: `reset_token`/`reset_token_expiry` populated by Task 3.
- Produces: `POST /api/educator/reset-password` → `{ success: true, message: "Password reset successfully" }` on success, or 400/404 error.

- [ ] **Step 1: Append `resetPassword` to the controller**

Add to the end of `Viewebit-backend/controllers/EducatorController/educatorAuthController.js`:

```js
// Forgot password - Step 3: Set new password using the reset token from Step 2
exports.resetPassword = async (req, res, next) => {
    try {
        const { email, resetToken, newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return next(new ErrorHandler('Password must be at least 6 characters', 400));
        }

        const educator = await Educator.findOne({ where: { email } });
        if (!educator) return next(new ErrorHandler('Reset link expired, please try again', 400));

        if (!educator.reset_token || !educator.reset_token_expiry) {
            return next(new ErrorHandler('Reset link expired, please try again', 400));
        }

        if (new Date() > new Date(educator.reset_token_expiry)) {
            educator.reset_token = null;
            educator.reset_token_expiry = null;
            await educator.save();
            return next(new ErrorHandler('Reset link expired, please try again', 400));
        }

        if (educator.reset_token !== resetToken) {
            return next(new ErrorHandler('Reset link expired, please try again', 400));
        }

        educator.password = await bcrypt.hash(newPassword, 10);
        educator.reset_token = null;
        educator.reset_token_expiry = null;
        educator.current_session_id = null;
        await educator.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (err) {
        console.error('Educator reset password error:', err);
        return next(new ErrorHandler('Failed to reset password', 500));
    }
};
```

- [ ] **Step 2: Append the route**

In `Viewebit-backend/routes/EducatorRoutes/educatorAuthRoutes.js`, find:
```js
router.post('/verify-reset-otp', educatorAuthController.verifyResetOTP);
```
Add directly below it:
```js
router.post('/reset-password', educatorAuthController.resetPassword);
```

- [ ] **Step 3: Verify the backend loads cleanly**

Run: `cd "Viewebit-backend" && node -e "require('./models'); require('./routes/index'); console.log('ALL OK');"`
Expected: `ALL OK`.

- [ ] **Step 4: Verify invalid-token rejection and short-password rejection**

With the dev server running:
```bash
curl -s -X POST http://localhost:3000/api/educator/reset-password -H "Content-Type: application/json" -d '{"email":"nonexistent-educator@example.com","resetToken":"bad-token","newPassword":"newpass123"}'
curl -s -X POST http://localhost:3000/api/educator/reset-password -H "Content-Type: application/json" -d '{"email":"nonexistent-educator@example.com","resetToken":"bad-token","newPassword":"abc"}'
```
Expected: first returns 400 `{"success":false,"message":"Reset link expired, please try again",...}`; second returns 400 `{"success":false,"message":"Password must be at least 6 characters",...}`.

- [ ] **Step 5: Commit**

```bash
cd "Viewebit-backend" && git add controllers/EducatorController/educatorAuthController.js routes/EducatorRoutes/educatorAuthRoutes.js && git commit -m "Add educator reset-password endpoint"
```

---

### Task 5: Frontend — auth service methods

**Files:**
- Modify: `Viewebit-EducatorPanel/src/services/auth.ts` (append)

**Interfaces:**
- Consumes: backend response shapes from Tasks 2-4.
- Produces: `authService.forgotPassword({email}): Promise<{message: string}>`, `authService.verifyResetOTP({email, otp}): Promise<{resetToken: string}>`, `authService.resetPassword({email, resetToken, newPassword}): Promise<{message: string}>`. Tasks 6-8 call these by these exact names.

- [ ] **Step 1: Append the 3 new methods and their input types**

In `Viewebit-EducatorPanel/src/services/auth.ts`, find:
```ts
interface ResendOTPData {
  email: string;
}
```
Add directly below it:
```ts
interface ForgotPasswordData {
  email: string;
}

interface VerifyResetOTPData {
  email: string;
  otp: string;
}

interface ResetPasswordData {
  email: string;
  resetToken: string;
  newPassword: string;
}
```

Then find:
```ts
  resendOTP: async (data: ResendOTPData): Promise<void> => {
    await api.post('/educator/resend-otp', data);
  },
```
Add directly below it:
```ts
  forgotPassword: async (data: ForgotPasswordData): Promise<{ message: string }> => {
    const response = await api.post('/educator/forgot-password', data);
    return response.data;
  },

  verifyResetOTP: async (data: VerifyResetOTPData): Promise<{ resetToken: string }> => {
    const response = await api.post('/educator/verify-reset-otp', data);
    return response.data.data;
  },

  resetPassword: async (data: ResetPasswordData): Promise<{ message: string }> => {
    const response = await api.post('/educator/reset-password', data);
    return response.data;
  },
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep "services/auth"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/services/auth.ts && git commit -m "Add forgot-password service methods"
```

---

### Task 6: Frontend — `ForgotPasswordForm` component

**Files:**
- Create: `Viewebit-EducatorPanel/src/components/auth/ForgotPasswordForm.tsx`

**Interfaces:**
- Consumes: `authService.forgotPassword` from Task 5.
- Produces: `<ForgotPasswordForm onSent={(email: string) => void} onBack={() => void} />`. Task 9 renders this component and wires its callbacks.

- [ ] **Step 1: Write the component**

```tsx
// Viewebit-EducatorPanel/src/components/auth/ForgotPasswordForm.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Mail } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import logo from '../../assets/Viewebit.jpg';
import { authService } from '../../services/auth';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
  onSent: (email: string) => void;
  onBack: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onSent, onBack }) => {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const response = await authService.forgotPassword({ email: data.email });
      toast.success(response.message);
      onSent(data.email);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to send reset code. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-primary-100">
            <img src={logo} alt="Viewebit Logo" style={{ borderRadius: '50%' }} />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Reset Password</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Enter your email and we'll send you a reset code</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                {...register('email')}
                type="email"
                className={`block w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                placeholder="educator@viewebit.com"
              />
            </div>
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </div>
              ) : (
                'Send Reset Code'
              )}
            </button>
          </div>

          <div className="flex justify-center">
            <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep "ForgotPasswordForm"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/components/auth/ForgotPasswordForm.tsx && git commit -m "Add ForgotPasswordForm component"
```

---

### Task 7: Frontend — `ResetOTPForm` component

**Files:**
- Create: `Viewebit-EducatorPanel/src/components/auth/ResetOTPForm.tsx`

**Interfaces:**
- Consumes: `authService.verifyResetOTP`, `authService.forgotPassword` (for resend) from Task 5.
- Produces: `<ResetOTPForm email={string} onVerified={(resetToken: string) => void} onBack={() => void} />`. Task 9 renders this and wires its callbacks.

- [ ] **Step 1: Write the component**

```tsx
// Viewebit-EducatorPanel/src/components/auth/ResetOTPForm.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Lock, Mail, RefreshCw } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import logo from '../../assets/Viewebit.jpg';
import { authService } from '../../services/auth';

const otpSchema = z.object({
  otp: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must contain only numbers'),
});

type OTPFormData = z.infer<typeof otpSchema>;

interface ResetOTPFormProps {
  email: string;
  onVerified: (resetToken: string) => void;
  onBack: () => void;
}

export const ResetOTPForm: React.FC<ResetOTPFormProps> = ({ email, onVerified, onBack }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<OTPFormData>({
    resolver: zodResolver(otpSchema),
  });

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (resendCooldown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const onSubmit = async (data: OTPFormData) => {
    setIsLoading(true);
    try {
      const response = await authService.verifyResetOTP({ email, otp: data.otp });
      onVerified(response.resetToken);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Invalid or expired code. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    try {
      await authService.forgotPassword({ email });
      toast.success('New reset code sent to your email');
      setTimeLeft(600);
      setCanResend(false);
      setResendCooldown(60);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to resend code. Please try again.';
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  const handleOTPInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setValue('otp', value);
    if (value.length === 6) {
      handleSubmit(onSubmit)();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-primary-100">
            <img src={logo} alt="Viewebit Logo" style={{ borderRadius: '50%' }} />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Enter Reset Code</h2>
          <p className="mt-2 text-center text-sm text-gray-600">We've sent a 6-digit code to</p>
          <p className="text-center text-sm font-medium text-primary-600 flex items-center justify-center gap-2">
            <Mail className="h-4 w-4" />
            {email}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 text-center mb-2">
              Reset Code
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                {...register('otp')}
                type="text"
                inputMode="numeric"
                maxLength={6}
                onChange={handleOTPInput}
                className={`block w-full pl-10 pr-3 py-3 border rounded-lg text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                  errors.otp ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="000000"
                autoComplete="off"
              />
            </div>
            {errors.otp && <p className="mt-2 text-sm text-red-600 text-center">{errors.otp.message}</p>}
          </div>

          <div className="flex items-center justify-center space-x-2">
            {timeLeft > 0 ? (
              <div className="flex items-center text-sm text-gray-500">
                <svg className="animate-spin h-4 w-4 mr-2 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Code expires in <span className="font-semibold ml-1 text-primary-600">{formatTime(timeLeft)}</span>
              </div>
            ) : (
              <p className="text-sm text-red-600 font-medium">Reset code has expired</p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || timeLeft === 0}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verifying...
                </div>
              ) : (
                'Verify Code'
              )}
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-gray-500">Didn't receive the code?</p>
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={!canResend || isResending || timeLeft === 0}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                canResend && timeLeft > 0 ? 'text-primary-600 hover:text-primary-700 cursor-pointer' : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
              {isResending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
          </div>

          <div className="flex justify-center">
            <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep "ResetOTPForm"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/components/auth/ResetOTPForm.tsx && git commit -m "Add ResetOTPForm component"
```

---

### Task 8: Frontend — `ResetNewPasswordForm` component

**Files:**
- Create: `Viewebit-EducatorPanel/src/components/auth/ResetNewPasswordForm.tsx`

**Interfaces:**
- Consumes: `authService.resetPassword` from Task 5.
- Produces: `<ResetNewPasswordForm email={string} resetToken={string} onSuccess={() => void} onBack={() => void} />`. Task 9 renders this and wires its callbacks.

- [ ] **Step 1: Write the component**

```tsx
// Viewebit-EducatorPanel/src/components/auth/ResetNewPasswordForm.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import logo from '../../assets/Viewebit.jpg';
import { authService } from '../../services/auth';

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface ResetNewPasswordFormProps {
  email: string;
  resetToken: string;
  onSuccess: () => void;
  onBack: () => void;
}

export const ResetNewPasswordForm: React.FC<ResetNewPasswordFormProps> = ({ email, resetToken, onSuccess, onBack }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const response = await authService.resetPassword({ email, resetToken, newPassword: data.newPassword });
      toast.success(response.message);
      onSuccess();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to reset password. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-primary-100">
            <img src={logo} alt="Viewebit Logo" style={{ borderRadius: '50%' }} />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Set New Password</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Choose a new password for your account</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                {...register('newPassword')}
                type={showPassword ? 'text' : 'password'}
                className={`block w-full pl-10 pr-10 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${errors.newPassword ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                placeholder="Enter new password"
              />
              <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" /> : <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
              </button>
            </div>
            {errors.newPassword && <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                {...register('confirmPassword')}
                type={showPassword ? 'text' : 'password'}
                className={`block w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${errors.confirmPassword ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                placeholder="Confirm new password"
              />
            </div>
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>}
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Resetting...
                </div>
              ) : (
                'Reset Password'
              )}
            </button>
          </div>

          <div className="flex justify-center">
            <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit 2>&1 | grep "ResetNewPasswordForm"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/components/auth/ResetNewPasswordForm.tsx && git commit -m "Add ResetNewPasswordForm component"
```

---

### Task 9: Frontend — wire the flow into `LoginForm`

**Files:**
- Modify: `Viewebit-EducatorPanel/src/components/auth/LoginForm.tsx`

**Interfaces:**
- Consumes: `ForgotPasswordForm` (Task 6), `ResetOTPForm` (Task 7), `ResetNewPasswordForm` (Task 8).

- [ ] **Step 1: Add imports and screen-swap state**

In `Viewebit-EducatorPanel/src/components/auth/LoginForm.tsx`, find:
```tsx
import { OTPVerificationForm } from './OTPVerificationForm';
```
Replace with:
```tsx
import { OTPVerificationForm } from './OTPVerificationForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { ResetOTPForm } from './ResetOTPForm';
import { ResetNewPasswordForm } from './ResetNewPasswordForm';
```

Find:
```tsx
  const [showOTPScreen, setShowOTPScreen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
```
Replace with:
```tsx
  const [showOTPScreen, setShowOTPScreen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'none' | 'email' | 'otp' | 'reset'>('none');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
```

- [ ] **Step 2: Add the screen-swap renders**

Find:
```tsx
  if (showOTPScreen && userEmail) {
    return <OTPVerificationForm email={userEmail} onSuccess={onSuccess} onBack={handleBackToLogin} />;
  }
```
Replace with:
```tsx
  if (showOTPScreen && userEmail) {
    return <OTPVerificationForm email={userEmail} onSuccess={onSuccess} onBack={handleBackToLogin} />;
  }

  const handleBackFromForgot = () => {
    setForgotStep('none');
    setResetEmail('');
    setResetToken('');
  };

  if (forgotStep === 'email') {
    return (
      <ForgotPasswordForm
        onSent={(email) => {
          setResetEmail(email);
          setForgotStep('otp');
        }}
        onBack={handleBackFromForgot}
      />
    );
  }

  if (forgotStep === 'otp') {
    return (
      <ResetOTPForm
        email={resetEmail}
        onVerified={(token) => {
          setResetToken(token);
          setForgotStep('reset');
        }}
        onBack={handleBackFromForgot}
      />
    );
  }

  if (forgotStep === 'reset') {
    return (
      <ResetNewPasswordForm
        email={resetEmail}
        resetToken={resetToken}
        onSuccess={handleBackFromForgot}
        onBack={handleBackFromForgot}
      />
    );
  }
```

- [ ] **Step 3: Add the "Forgot password?" link**

Find:
```tsx
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
            </div>
          </div>

          <div>
            <button
              type="submit"
```
Replace with:
```tsx
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => setForgotStep('email')}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Forgot password?
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
```

- [ ] **Step 4: Verify typecheck and build**

Run: `cd "Viewebit-EducatorPanel" && npx tsc --noEmit`
Expected: no errors.

Run: `cd "Viewebit-EducatorPanel" && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual click-through against a running backend**

With `Viewebit-backend` running (`npm run dev`) and `Viewebit-EducatorPanel` running (`npm run dev`), in the browser:
1. On the login screen, click "Forgot password?" → email form appears.
2. Enter a real seeded educator's email, submit → toast shows the generic message, screen advances to the code entry.
3. Check that educator's inbox for the "Password Reset Code" email, enter the 6-digit code → screen advances to the new-password form.
4. Enter a new password (6+ chars) and matching confirm password, submit → success toast, returns to the login screen.
5. Log in with the new password → succeeds (still requires login OTP as before, unaffected by this change).
6. Regression: confirm the existing login flow (no forgot-password involved) still works end-to-end.

- [ ] **Step 6: Commit**

```bash
cd "Viewebit-EducatorPanel" && git add src/components/auth/LoginForm.tsx && git commit -m "Wire forgot-password flow into LoginForm"
```
