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
export type { ApiError } from './api-client-core';

// Manual verification helper: run `__pitstopDebug.triggerUnauthorized()` in
// the browser console to simulate a real 401 without touching Firebase or
// the backend. The wrapper and the global it's attached to are both
// dead-code-eliminated from production builds (import.meta.env.DEV is
// statically false there, so the ternary and the `if` block both collapse
// away — verified by grepping dist/ after `pnpm build`).
let latestUnauthorizedHandler: (() => void | Promise<void>) | undefined;

export const setUnauthorizedHandler = import.meta.env.DEV
  ? (handler: () => void | Promise<void>) => {
      latestUnauthorizedHandler = handler;
      configuredClient.setUnauthorizedHandler(handler);
    }
  : configuredClient.setUnauthorizedHandler;

if (import.meta.env.DEV) {
  const debugGlobal = window as unknown as { __pitstopDebug?: Record<string, unknown> };
  debugGlobal.__pitstopDebug = {
    ...debugGlobal.__pitstopDebug,
    triggerUnauthorized: () => latestUnauthorizedHandler?.(),
  };
}
