export function getSafeRedirect(value: unknown): string | undefined {
  // Blocks '//' and '/\' too — both parse as protocol-relative (WHATWG URL spec).
  if (typeof value === 'string' && value.startsWith('/') && value[1] !== '/' && value[1] !== '\\') {
    return value;
  }

  return undefined;
}

const PUBLIC_AUTH_PATHS = new Set(['/bienvenida', '/login', '/register', '/forgot-password']);

// A post-auth destination must also skip the public auth screens, or an
// authenticated user would bounce between them.
export function getPostAuthRedirect(value: unknown): string | undefined {
  const redirect = getSafeRedirect(value);
  // Lowercased: the router matches routes case-insensitively (`caseSensitive` defaults to false).
  const pathname = redirect
    ?.split(/[?#]/)[0]
    .replace(/(.)\/+$/, '$1')
    .toLowerCase();
  return pathname && PUBLIC_AUTH_PATHS.has(pathname) ? undefined : redirect;
}
