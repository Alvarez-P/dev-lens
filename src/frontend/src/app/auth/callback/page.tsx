'use client';

import { useEffect, useState } from 'react';
import { post, isSuccessResponse } from '@/lib/api-client';
import { OAUTH_ENDPOINTS, STORAGE_KEYS } from '@/lib/constants';
import { Spinner } from '@/components/atoms/spinner';

export default function OAuthCallbackPage(): React.ReactNode {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      setError('Missing authorization code.');
      return;
    }

    post<{ accessToken: string; refreshToken: string }>(OAUTH_ENDPOINTS.TOKEN_EXCHANGE, { code })
      .then((response) => {
        if (!isSuccessResponse(response)) {
          throw new Error('Token exchange failed');
        }
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.data.accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.data.refreshToken);
        window.location.href = '/organizations';
      })
      .catch(() => {
        setError('Authentication failed. Please try again.');
      });
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950">
        <div className="text-center">
          <p className="text-error-400">{error}</p>
          <a href="/login" className="mt-4 inline-block text-primary-400 hover:text-primary-300">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950">
      <Spinner size="lg" />
    </div>
  );
}
