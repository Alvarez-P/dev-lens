'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/molecules/toast-provider';
import { LogIn, Github } from 'lucide-react';

const showOAuthButtons = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

export default function LoginPage(): React.ReactNode {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { login, loginWithProvider } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  function validate(): boolean {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login({ email, password });
      toast('Welcome back!', 'success');
      router.push('/organizations');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed. Please try again.';
      toast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-surface-100">Sign in</h2>
      <p className="mt-1 text-sm text-surface-400">Enter your credentials to access your account</p>

      {showOAuthButtons && (
        <>
          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              leftIcon={<Github className="h-4 w-4" />}
              onClick={() => loginWithProvider('github')}
            >
              Sign in with GitHub
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface-900 px-2 text-surface-400">or continue with</span>
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="john@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="current-password"
        />

        <div className="flex items-center justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-primary-400 transition-colors hover:text-primary-300"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full"
          leftIcon={<LogIn className="h-4 w-4" />}
        >
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-surface-400">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium text-primary-400 transition-colors hover:text-primary-300"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
