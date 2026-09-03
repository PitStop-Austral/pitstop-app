export function getSafeRedirect(value: unknown): string | undefined {
  // A second leading '/' or '\' makes the browser's URL parser treat this as
  // protocol-relative (e.g. "/\evil.com" resolves like "//evil.com").
  if (typeof value === 'string' && value.startsWith('/') && value[1] !== '/' && value[1] !== '\\') {
    return value;
  }

  return undefined;
}
