export type SignOutDeps = {
  firebaseSignOut: () => Promise<void>;
  clearQueryCache: () => void;
  navigateToLogin: () => Promise<unknown>;
  onError: (error: unknown) => void;
  setIsSigningOut: (value: boolean) => void;
};

export function createSignOut(deps: SignOutDeps): () => Promise<void> {
  let inFlight: Promise<void> | null = null;

  return function signOut(): Promise<void> {
    // Callers (the logout button, the 401 handler) may invoke this
    // concurrently; returning the same in-flight promise instead of
    // starting a new run avoids a second execution finishing (and
    // clearing isSigningOut) while the first is still mid-flight, which
    // would reopen the guard redirect race this module exists to prevent.
    if (inFlight) {
      return inFlight;
    }

    const run = async () => {
      deps.setIsSigningOut(true);
      try {
        await deps.firebaseSignOut();
        deps.clearQueryCache();
        await deps.navigateToLogin();
      } catch (error) {
        deps.onError(error);
      } finally {
        deps.setIsSigningOut(false);
        inFlight = null;
      }
    };

    inFlight = run();
    return inFlight;
  };
}
