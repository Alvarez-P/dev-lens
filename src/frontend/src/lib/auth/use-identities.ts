import { useCallback } from 'react';
import { fetchLinkedIdentities, unlinkIdentityRequest } from './auth.service';
import type { LinkedIdentity } from './auth-types';

export function useIdentities() {
  const getLinkedIdentities = useCallback(async (): Promise<LinkedIdentity[]> => {
    return fetchLinkedIdentities();
  }, []);

  const unlinkIdentity = useCallback(async (identityId: string): Promise<void> => {
    await unlinkIdentityRequest(identityId);
  }, []);

  return { getLinkedIdentities, unlinkIdentity };
}
