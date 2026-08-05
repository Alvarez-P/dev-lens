'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { patch } from '@/lib/api-client';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { useToast } from '@/components/molecules/toast-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { User, Save, Shield } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage(): React.ReactNode {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [isSaving, setIsSaving] = useState(false);

  if (user && !firstName && !lastName) {
    setFirstName(user.firstName);
    setLastName(user.lastName);
  }

  async function handleSave(e: FormEvent): Promise<void> {
    e.preventDefault();

    setIsSaving(true);
    try {
      await patch('/api/v1/users/profile', { firstName, lastName });
      toast('Profile updated successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      toast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" description="Manage your account settings" />

      <div className="rounded-xl border border-white/[0.04] bg-surface-900/60 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 border-b border-white/[0.04] pb-4">
          <User className="h-5 w-5 text-surface-400" />
          <h3 className="text-sm font-semibold text-surface-200">Profile</h3>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <Input
            label="Email"
            value={user?.email ?? ''}
            disabled
            helperText="Email cannot be changed"
          />

          <div className="flex justify-end">
            <Button type="submit" isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
              Save changes
            </Button>
          </div>
        </form>
      </div>

      <Link
        href="/settings/security"
        className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-surface-900/60 backdrop-blur-sm p-6 transition-all duration-200 hover:border-primary-500/20 hover:shadow-glow"
      >
        <Shield className="h-5 w-5 text-surface-400" />
        <div>
          <h3 className="text-sm font-semibold text-surface-200">Security</h3>
          <p className="text-xs text-surface-400">Manage password and authentication</p>
        </div>
      </Link>
    </div>
  );
}
