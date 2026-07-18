import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Lock, Mail, RefreshCw } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import logo from '../../assets/Viewebit.jpg';
import { authService } from '../../services/auth';

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only numbers'),
});

type OTPFormData = z.infer<typeof otpSchema>;

interface OTPVerificationFormProps {
  email: string;
  onSuccess: () => void;
  onBack: () => void;
}

export const OTPVerificationForm: React.FC<OTPVerificationFormProps> = ({ email, onSuccess, onBack }) => {
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
      await authService.verifyOTP({ email, otp: data.otp });
      toast.success('Login successful!');
      window.location.reload();
      onSuccess();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Invalid verification code. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    try {
      await authService.resendOTP({ email });
      toast.success('New verification code sent to your email');
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
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Enter Verification Code</h2>
          <p className="mt-2 text-center text-sm text-gray-600">We've sent a 6-digit code to</p>
          <p className="text-center text-sm font-medium text-primary-600 flex items-center justify-center gap-2">
            <Mail className="h-4 w-4" />
            {email}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 text-center mb-2">
              Verification Code
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
              <p className="text-sm text-red-600 font-medium">Verification code has expired</p>
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
                'Verify & Login'
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

          <div className="text-center">
            <p className="text-xs text-gray-500">Need help? Contact your institution admin</p>
          </div>
        </form>
      </div>
    </div>
  );
};
