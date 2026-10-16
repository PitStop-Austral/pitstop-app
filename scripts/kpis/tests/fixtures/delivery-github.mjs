export const window = {
  windowStart: '2026-09-22T03:00:00.000Z',
  windowEnd: '2026-10-22T03:00:00.000Z',
};

export const ciRuns = [
  { conclusion: 'success', status: 'completed', updated_at: '2026-10-20T10:00:00.000Z' },
  { conclusion: 'failure', status: 'completed', updated_at: '2026-10-20T10:00:00.000Z' },
  { conclusion: 'cancelled', status: 'completed', updated_at: '2026-10-20T10:00:00.000Z' },
  { conclusion: 'skipped', status: 'completed', updated_at: '2026-10-20T10:00:00.000Z' },
  { conclusion: 'timed_out', status: 'completed', updated_at: '2026-10-20T10:00:00.000Z' },
  { conclusion: 'neutral', status: 'completed', updated_at: '2026-10-20T10:00:00.000Z' },
  { conclusion: null, status: 'in_progress', updated_at: '2026-10-20T10:00:00.000Z' },
];

export const pullRequests = [
  {
    number: 1,
    created_at: '2026-10-20T01:30:00.000Z',
    merged_at: '2026-10-20T03:00:00.000Z',
  },
  {
    number: 2,
    created_at: '2026-10-20T01:00:00.000Z',
    merged_at: '2026-10-20T04:30:00.000Z',
  },
];
