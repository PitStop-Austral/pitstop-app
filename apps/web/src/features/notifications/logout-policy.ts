type ErrorWithStatus = { status?: number };

export function shouldBlockManualLogout(error: unknown): boolean {
  const status = (error as ErrorWithStatus | null)?.status;
  return status == null || status === 0 || status >= 500;
}
