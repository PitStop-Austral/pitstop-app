export function getSafeRedirect(value: unknown): string | undefined {
  // Blocks '//' and '/\' too — both parse as protocol-relative (WHATWG URL spec).
  if (typeof value === 'string' && value.startsWith('/') && value[1] !== '/' && value[1] !== '\\') {
    return value;
  }

  return undefined;
}
