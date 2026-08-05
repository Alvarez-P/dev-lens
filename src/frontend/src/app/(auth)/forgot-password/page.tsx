'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { useToast } from '@/components/molecules/toast-provider';
import { post } from '@/lib/api-client';
import { Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage(): React.ReactNode {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { toast } = useToast();

  function validate(): boolean {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format');
      return false;
    }
    setError(undefined);
    return true;
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await post('/api/v1/auth/forgot-password', { email });
      setIsSent(true);
      toast('If an account with that email exists, a reset link has been sent.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-500/10">
          <Mail className="h-6 w-6 text-success-400" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-surface-100">Check your email</h2>
        <p className="mt-2 text-sm text-surface-400">
          If an account with <strong className="text-surface-200">{email}</strong> exists,
          we&apos;ve sent a password reset link.
        </p>
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

  return (
    <div>
      <h2 className="text-xl font-semibold text-surface-100">Forgot password</h2>
      <p className="mt-1 text-sm text-surface-400">
        Enter your email address and we&apos;ll send you a reset link
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="john@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(undefined);
          }}
          error={error}
          autoComplete="email"
        />

        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full"
          leftIcon={<Mail className="h-4 w-4" />}
        >
          Send reset link
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
