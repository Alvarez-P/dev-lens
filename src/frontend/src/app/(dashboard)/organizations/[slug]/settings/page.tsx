'use client';

import { useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get, patch, del } from '@/lib/api-client';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast-provider';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
}

export default function OrganizationSettingsPage(): JSX.Element {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { toast } = useToast();

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization-settings', slug],
    queryFn: async () => {
      const allOrgs = await get<OrganizationDetail[]>('/api/v1/organizations');
      if ('success' in allOrgs && allOrgs.success) {
        const orgs = allOrgs.data as unknown as OrganizationDetail[];
        const found = orgs.find((o) => o.slug === slug);
        if (found) return found;
      }
      throw new Error('Organization not found');
    },
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  // Initialize form when org data loads
  if (org && !formInitialized) {
    setName(org.name);
    setDescription(org.description ?? '');
    setFormInitialized(true);
  }

  async function handleSave(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!org) return;

    setIsSaving(true);
    try {
      await patch(`/api/v1/organizations/${org.id}`, { name, description });
      toast('Organization updated successfully', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update organization';
      toast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!org) return;
    if (
      !window.confirm(
        'Are you sure you want to delete this organization? This action cannot be undone.',
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await del(`/api/v1/organizations/${org.id}`);
      toast('Organization deleted', 'success');
      router.push('/organizations');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete organization';
      toast(message, 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="py-12 text-center">
        <p className="text-surface-400">Organization not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href={`/organizations/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-surface-400 transition-colors hover:text-surface-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to organization
        </Link>
      </div>

      <PageHeader title="Organization settings" description={`Manage ${org.name}`} />

      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-xl border border-surface-800 bg-surface-900 p-6"
      >
        <Input
          label="Organization name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Corp"
        />

        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description..."
        />

        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
            Save changes
          </Button>
        </div>
      </form>

      {/* Danger zone */}
      <div className="rounded-xl border border-error-500/30 bg-error-500/5 p-6">
        <h3 className="text-lg font-semibold text-error-400">Danger zone</h3>
        <p className="mt-1 text-sm text-surface-400">
          Deleting the organization is irreversible. All data will be permanently removed.
        </p>
        <div className="mt-4">
          <Button
            variant="danger"
            isLoading={isDeleting}
            onClick={handleDelete}
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            Delete organization
          </Button>
        </div>
      </div>
    </div>
  );
}
