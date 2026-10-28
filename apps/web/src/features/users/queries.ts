import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCurrentUser, getProfileSummary, updateMe } from './api';
import type { CurrentUser } from './api';

export const currentUserQueryKey = ['me'] as const;
export const profileSummaryQueryKey = ['me', 'profile-summary'] as const;

export const currentUserQueryOptions = queryOptions({
  queryKey: currentUserQueryKey,
  queryFn: ({ signal }) => getCurrentUser(signal),
});

export function useCurrentUser() {
  return useQuery(currentUserQueryOptions);
}

export function useProfileSummary() {
  return useQuery({
    queryKey: profileSummaryQueryKey,
    queryFn: ({ signal }) => getProfileSummary(signal),
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMe,
    onSuccess: (updated) => {
      queryClient.setQueryData<CurrentUser>(currentUserQueryKey, updated);
    },
  });
}
