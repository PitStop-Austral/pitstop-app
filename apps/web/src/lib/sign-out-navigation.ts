export type SignOutOptions = {
  preserveLocation?: boolean;
};

export type SignOutNavigation = {
  to: '/login';
  replace: true;
  search: { redirect?: string };
};

export function resolveSignOutNavigation(
  currentHref: string,
  options?: SignOutOptions,
): SignOutNavigation {
  const redirect = options?.preserveLocation ? currentHref : undefined;
  return { to: '/login', replace: true, search: redirect ? { redirect } : {} };
}
