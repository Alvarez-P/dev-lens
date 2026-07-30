'use client';

import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast-provider';
import { post } from '@/lib/api-client';
import { UserPlus } from 'lucide-react';

const roleOptions: SelectOption[] = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
  { value: 'viewer', label: 'Viewer' },
];

interface InviteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onInvited: () => void;
}

export function InviteMemberDialog({
  isOpen,
  onClose,
  organizationId,
  onInvited,
}: InviteMemberDialogProps): React.ReactNode {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { toast } = useToast();

  function handleClose(): void {
    setEmail('');
    setRole('member');
    setError(undefined);
    onClose();
  }

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
      await post(`/api/v1/organizations/${organizationId}/members`, {
        email: email.trim(),
        role,
      });
      toast('Member invited successfully', 'success');
      handleClose();
      onInvited();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite member';
      toast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite member" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          placeholder="john@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(undefined);
          }}
          error={error}
          autoFocus
        />

        <Select
          label="Role"
          options={roleOptions}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
