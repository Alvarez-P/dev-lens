'use client';

import { Suspense, useState, type FormEvent, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-provider';
import { post } from '@/lib/api-client';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

/**
 * Inner component that uses useSearchParams.
 * Must be wrapped in a Suspense boundary.
 */
function ResetPasswordForm(): JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!token) {
      toast('Invalid reset link. Please request a new one.', 'error');
    }
  }, [token, toast]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!password) {
      newErrors.password = 'New password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();

    if (!validate() || !token) return;

    setIsSubmitting(true);
    try {
      await post('/api/v1/auth/reset-password', { token, newPassword: password });
      setIsSuccess(true);
      toast('Password reset successfully!', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      toast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-500/10">
          <KeyRound className="h-6 w-6 text-success-400" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-surface-100">Password reset</h2>
        <p className="mt-2 text-sm text-surface-400">Your password has been reset successfully.</p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-400 transition-colors hover:text-primary-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold text-surface-100">Invalid link</h2>
        <p className="mt-2 text-sm text-surface-400">
          This password reset link is invalid or has expired.
        </p>
        <div className="mt-6">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary-400 transition-colors hover:text-primary-300"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-surface-100">Reset password</h2>
      <p className="mt-1 text-sm text-surface-400">Enter your new password below</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          label="New password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.password;
                return next;
              });
            }
          }}
          error={errors.password}
          autoComplete="new-password"
        />

        <Input
          label="Confirm new password"
          type="password"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (errors.confirmPassword) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.confirmPassword;
                return next;
              });
            }
          }}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full"
          leftIcon={<KeyRound className="h-4 w-4" />}
        >
          Reset password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-surface-400">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-primary-400 transition-colors hover:text-primary-300"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

/**
 * Reset password page.
 * Wraps the form in a Suspense boundary for useSearchParams compatibility.
 */
export default function ResetPasswordPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
