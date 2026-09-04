import { signOut } from 'firebase/auth';

import { createApiClient } from './api-client-core';
import { auth } from './firebase';

async function defaultUnauthorizedHandler(): Promise<void> {
  try {
    await signOut(auth);
  } finally {
    window.location.assign('/login');
  }
}

const configuredClient = createApiClient({
  baseURL: import.meta.env.VITE_API_URL,
  getIdToken: async () => auth.currentUser?.getIdToken(),
  unauthorizedHandler: defaultUnauthorizedHandler,
});

export const apiClient = configuredClient.apiClient;
export const setUnauthorizedHandler = configuredClient.setUnauthorizedHandler;
export type { ApiError } from './api-client-core';
