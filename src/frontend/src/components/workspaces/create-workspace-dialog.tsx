'use client';

import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast-provider';
import { post } from '@/lib/api-client';
import { FolderPlus } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
}

interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organizations: Organization[];
  onCreated: () => void;
}

export function CreateWorkspaceDialog({
  isOpen,
  onClose,
  organizations,
  onCreated,
}: CreateWorkspaceDialogProps): React.ReactNode {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [organizationId, setOrganizationId] = useState(
    organizations.length > 0 ? organizations[0].id : '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { toast } = useToast();

  const orgOptions: SelectOption[] = organizations.map((org) => ({
    value: org.id,
    label: org.name,
  }));

  function handleClose(): void {
    setName('');
    setDescription('');
    setError(undefined);
    onClose();
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();

    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }
    if (!organizationId) {
      setError('Please select an organization');
      return;
    }

    setError(undefined);
    setIsSubmitting(true);

    try {
      await post('/api/v1/workspaces', {
        name: name.trim(),
        description: description.trim() || undefined,
        organizationId,
      });
      toast('Workspace created successfully', 'success');
      handleClose();
      onCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      toast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create workspace" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Organization"
          options={orgOptions}
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
        />

        <Input
          label="Workspace name"
          placeholder="Main workspace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          autoFocus
        />

        <Input
          label="Description (optional)"
          placeholder="What is this workspace for?"
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
            leftIcon={<FolderPlus className="h-4 w-4" />}
          >
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
