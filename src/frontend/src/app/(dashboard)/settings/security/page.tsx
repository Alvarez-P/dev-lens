'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/molecules/toast-provider';
import { KeyRound, ShieldCheck, Github, Unlink, AlertTriangle } from 'lucide-react';
import type { LinkedIdentity } from '@/lib/auth/auth-types';

export default function SecurityPage(): React.ReactNode {
  const { toast } = useToast();
  const { getLinkedIdentities, unlinkIdentity } = useAuth();
  const [identities, setIdentities] = useState<LinkedIdentity[]>([]);
  const [isLoadingIdentities, setIsLoadingIdentities] = useState(true);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const loadIdentities = useCallback(async () => {
    try {
      const result = await getLinkedIdentities();
      setIdentities(result);
    } catch {
      // Silently fail — identities section just won't render
    } finally {
      setIsLoadingIdentities(false);
    }
  }, [getLinkedIdentities]);

  useEffect(() => {
    loadIdentities();
  }, [loadIdentities]);

  async function handleUnlink(identity: LinkedIdentity): Promise<void> {
    setUnlinkingId(identity.id);
    try {
      await unlinkIdentity(identity.id);
      setIdentities((prev) => prev.filter((i) => i.id !== identity.id));
      toast(`Unlinked ${identity.displayName ?? identity.provider}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unlink identity';
      toast(message, 'error');
    } finally {
      setUnlinkingId(null);
    }
  }

  function providerIcon(provider: string): React.ReactNode {
    switch (provider) {
      case 'github':
        return <Github className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Security" description="Manage your password and authentication settings" />

      {/* Linked Identities Section */}
      {!isLoadingIdentities && identities.length > 0 && (
        <div className="rounded-xl border border-white/[0.04] bg-surface-900/60 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 border-b border-white/[0.04] pb-4">
            <ShieldCheck className="h-5 w-5 text-surface-400" />
            <h3 className="text-sm font-semibold text-surface-200">Linked accounts</h3>
          </div>

          <div className="mt-4 space-y-3">
            {identities.map((identity) => (
              <div
                key={identity.id}
                className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-surface-300">
                    {providerIcon(identity.provider)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-200 capitalize">
                      {identity.provider}
                    </p>
                    {identity.displayName && (
                      <p className="text-xs text-surface-400">{identity.displayName}</p>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlink(identity)}
                  isLoading={unlinkingId === identity.id}
                  className="text-error-400 hover:text-error-300 hover:bg-error-500/10"
                  leftIcon={<Unlink className="h-4 w-4" />}
                >
                  Unlink
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change Password Section */}
      <div className="rounded-xl border border-white/[0.04] bg-surface-900/60 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 border-b border-white/[0.04] pb-4">
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
            <Button
              onClick={() => toast('Password change will be available in a future update.', 'info')}
              leftIcon={<ShieldCheck className="h-4 w-4" />}
            >
              Update password
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
