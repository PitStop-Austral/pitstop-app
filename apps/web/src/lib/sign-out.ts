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
    // Concurrent calls share this run instead of starting a new one —
    // see docs/auth.md for the race this avoids.
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
