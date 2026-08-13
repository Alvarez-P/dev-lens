'use client';

import { Modal } from '@/components/molecules/modal';
import { Button } from '@/components/atoms/button';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isLoading = false,
}: ConfirmDialogProps): React.ReactNode {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-500/10">
          <AlertTriangle className="h-5 w-5 text-error-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-surface-100">{title}</h3>
          <p className="mt-1 text-sm text-surface-400">{description}</p>
        </div>
      </div>
    </Modal>
  );
}
