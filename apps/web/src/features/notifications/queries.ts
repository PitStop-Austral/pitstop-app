import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { CurrentUser } from '@/features/users/api';
import { currentUserQueryKey } from '@/features/users/queries';
import type { ApiError } from '@/lib/api-client';
import { markNotificationPromptShown, registerNotificationDevice } from './api';

function isTransientError(error: unknown): boolean {
  const status = (error as Partial<ApiError> | null)?.status;
  return status === 0 || (typeof status === 'number' && status >= 500);
}

export function useRegisterNotificationDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: registerNotificationDevice,
    onSuccess: () => {
      queryClient.setQueryData<CurrentUser>(currentUserQueryKey, (current) =>
        current ? { ...current, notificationsEnabled: true } : current,
      );
    },
  });
}

export function useMarkNotificationPromptShown() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationPromptShown,
    retry: (failureCount, error) => failureCount < 2 && isTransientError(error),
    onSuccess: () => {
      queryClient.setQueryData<CurrentUser>(currentUserQueryKey, (current) =>
        current ? { ...current, notificationPromptShownAt: new Date().toISOString() } : current,
      );
    },
  });
}
