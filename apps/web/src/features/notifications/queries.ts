import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { CurrentUser } from '@/features/users/api';
import { currentUserQueryKey } from '@/features/users/queries';
import type { ApiError } from '@/lib/api-client';
import {
  markNotificationPromptShown,
  registerNotificationDevice,
  updateNotificationPreferences,
} from './api';
import {
  beginOptimisticNotificationPreference,
  rollbackNotificationPreference,
} from './notification-preferences';

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

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateNotificationPreferences,
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: currentUserQueryKey });
      const previousUser = queryClient.getQueryData<CurrentUser>(currentUserQueryKey);
      const update = beginOptimisticNotificationPreference(previousUser, enabled);

      queryClient.setQueryData<CurrentUser>(currentUserQueryKey, update.optimisticUser);

      return update;
    },
    onError: (_error, _enabled, context) => {
      if (context) {
        queryClient.setQueryData(currentUserQueryKey, rollbackNotificationPreference(context));
      }
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData<CurrentUser>(currentUserQueryKey, (current) =>
        current ? { ...current, ...preferences } : current,
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
