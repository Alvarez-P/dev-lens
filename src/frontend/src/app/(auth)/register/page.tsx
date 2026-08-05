'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/molecules/toast-provider';
import { UserPlus, Github } from 'lucide-react';

const showOAuthButtons = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

export default function RegisterPage(): React.ReactNode {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { register, loginWithProvider } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(field: string, value: string): void {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
      toast('Account created successfully!', 'success');
      router.push('/');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Registration failed. Please try again.';
      toast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-surface-100">Create account</h2>
      <p className="mt-1 text-sm text-surface-400">Fill in your details to get started</p>

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
              Sign up with GitHub
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
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            placeholder="John"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            error={errors.firstName}
            autoComplete="given-name"
          />
          <Input
            label="Last name"
            placeholder="Doe"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            error={errors.lastName}
            autoComplete="family-name"
          />
        </div>

        <Input
          label="Email"
          type="email"
          placeholder="john@example.com"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          error={errors.email}
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          error={errors.password}
          autoComplete="new-password"
        />

        <Input
          label="Confirm password"
          type="password"
          placeholder="Repeat your password"
          value={formData.confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full"
          leftIcon={<UserPlus className="h-4 w-4" />}
        >
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-surface-400">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-primary-400 transition-colors hover:text-primary-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
