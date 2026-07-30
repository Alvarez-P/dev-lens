'use client';

import { useState, useCallback } from 'react';
import { Key, Eye, EyeOff } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const providerOptions: SelectOption[] = [
  { value: 'GITHUB', label: 'GitHub' },
  { value: 'GITLAB', label: 'GitLab' },
  { value: 'BITBUCKET', label: 'Bitbucket' },
  { value: 'AZURE_DEVOPS', label: 'Azure DevOps' },
  { value: 'GENERIC', label: 'Generic Git' },
];

const typeOptions: SelectOption[] = [
  { value: 'PAT', label: 'Personal Access Token' },
  { value: 'SSH_KEY', label: 'SSH Key' },
];

export interface CreateCredentialDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    provider: string;
    name: string;
    type: string;
    value: string;
  }) => Promise<void>;
}

/**
 * Modal dialog for creating a new credential.
 * Form includes: provider, name, type (PAT/SSH), value (masked input).
 */
export function CreateCredentialDialog({
  isOpen,
  onClose,
  onSubmit,
}: CreateCredentialDialogProps): JSX.Element | null {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('GITHUB');
  const [type, setType] = useState('PAT');
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!name.trim()) {
        setError('Credential name is required');
        return;
      }
      if (!value.trim()) {
        setError('Credential value is required');
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit({
          provider,
          name: name.trim(),
          type,
          value: value.trim(),
        });
        setName('');
        setProvider('GITHUB');
        setType('PAT');
        setValue('');
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create credential');
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, provider, type, value, onSubmit, onClose],
  );

  const toggleShowValue = useCallback(() => {
    setShowValue((prev) => !prev);
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Credential"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-credential-form"
            isLoading={isSubmitting}
            leftIcon={<Key className="h-4 w-4" />}
          >
            Add Credential
          </Button>
        </>
      }
    >
      <form id="create-credential-form" onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Provider"
          options={providerOptions}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        />

        <Input
          label="Credential Name"
          placeholder="e.g., My GitHub PAT"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Select
          label="Credential Type"
          options={typeOptions}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />

        <Input
          label="Credential Value"
          placeholder={type === 'SSH_KEY' ? 'Paste SSH private key...' : 'ghp_xxxxxxxxxxxx'}
          type={showValue ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rightIcon={
            <button
              type="button"
              onClick={toggleShowValue}
              className="text-surface-400 hover:text-surface-200"
              aria-label={showValue ? 'Hide value' : 'Show value'}
            >
              {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          required
        />

        {type !== 'SSH_KEY' && (
          <Input label="Expires At (optional)" type="datetime-local" onChange={() => {}} />
        )}

        {error && (
          <p className="text-sm text-error-500" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
