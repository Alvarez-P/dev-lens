'use client';

import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-provider';
import { post } from '@/lib/api-client';
import { Building2 } from 'lucide-react';

interface CreateOrgDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateOrgDialog({
  isOpen,
  onClose,
  onCreated,
}: CreateOrgDialogProps): React.ReactNode {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { toast } = useToast();

  function handleClose(): void {
    setName('');
    setDescription('');
    setError(undefined);
    onClose();
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();

    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }

    setError(undefined);
    setIsSubmitting(true);

    try {
      await post('/api/v1/organizations', {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast('Organization created successfully', 'success');
      handleClose();
      onCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create organization';
      toast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create organization" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Organization name"
          placeholder="Acme Corp"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          autoFocus
        />

        <Input
          label="Description (optional)"
          placeholder="A brief description of your organization"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            leftIcon={<Building2 className="h-4 w-4" />}
          >
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
