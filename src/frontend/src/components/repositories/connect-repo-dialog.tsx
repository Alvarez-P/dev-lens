'use client';

import { useState, useCallback } from 'react';
import { GitBranch, Globe } from 'lucide-react';
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

export interface ConnectRepoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    url: string;
    provider: string;
    defaultBranch?: string;
  }) => Promise<void>;
}

/**
 * Modal dialog for connecting a new repository.
 * Form includes: name, URL, provider select, branch (optional).
 */
export function ConnectRepoDialog({
  isOpen,
  onClose,
  onSubmit,
}: ConnectRepoDialogProps): JSX.Element | null {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState('GITHUB');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!name.trim()) {
        setError('Repository name is required');
        return;
      }
      if (!url.trim()) {
        setError('Repository URL is required');
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit({
          name: name.trim(),
          url: url.trim(),
          provider,
          defaultBranch: defaultBranch || undefined,
        });
        // Reset form
        setName('');
        setUrl('');
        setProvider('GITHUB');
        setDefaultBranch('main');
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect repository');
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, url, provider, defaultBranch, onSubmit, onClose],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Repository"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="connect-repo-form"
            isLoading={isSubmitting}
            leftIcon={<GitBranch className="h-4 w-4" />}
          >
            Connect Repository
          </Button>
        </>
      }
    >
      <form id="connect-repo-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Repository Name"
          placeholder="e.g., my-awesome-project"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftIcon={<GitBranch className="h-4 w-4" />}
          required
        />

        <Input
          label="Git URL"
          placeholder="https://github.com/org/repo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          leftIcon={<Globe className="h-4 w-4" />}
          required
        />

        <Select
          label="Provider"
          options={providerOptions}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        />

        <Input
          label="Default Branch (optional)"
          placeholder="main"
          value={defaultBranch}
          onChange={(e) => setDefaultBranch(e.target.value)}
        />

        {error && (
          <p className="text-sm text-error-500" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
