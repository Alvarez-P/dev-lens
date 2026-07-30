'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-provider';
import { KeyRound, ShieldCheck } from 'lucide-react';

export default function SecurityPage(): JSX.Element {
  const { toast } = useToast();

  function handlePlaceholder(): void {
    toast('Password change will be available in a future update.', 'info');
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Security" description="Manage your password and authentication settings" />

      <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
        <div className="flex items-center gap-3 border-b border-surface-800 pb-4">
          <KeyRound className="h-5 w-5 text-surface-400" />
          <h3 className="text-sm font-semibold text-surface-200">Change password</h3>
        </div>

        <div className="mt-4 space-y-4">
          <Input
            label="Current password"
            type="password"
            placeholder="Enter current password"
            disabled
          />
          <Input
            label="New password"
            type="password"
            placeholder="At least 8 characters"
            disabled
          />
          <Input
            label="Confirm new password"
            type="password"
            placeholder="Repeat new password"
            disabled
          />

          <div className="flex justify-end">
            <Button onClick={handlePlaceholder} leftIcon={<ShieldCheck className="h-4 w-4" />}>
              Update password
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
