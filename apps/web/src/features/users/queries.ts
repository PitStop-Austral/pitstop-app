import { queryOptions, useQuery } from '@tanstack/react-query';

import { getCurrentUser } from './api';

export const currentUserQueryKey = ['me'] as const;

export const currentUserQueryOptions = queryOptions({
  queryKey: currentUserQueryKey,
  queryFn: ({ signal }) => getCurrentUser(signal),
});

export function useCurrentUser() {
  return useQuery(currentUserQueryOptions);
}
