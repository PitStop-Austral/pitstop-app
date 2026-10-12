export type SignOutReason = 'manual' | 'unauthorized';

export type SignOutDeps = {
  prepare: (reason: SignOutReason) => Promise<void>;
  firebaseSignOut: () => Promise<void>;
  clearQueryCache: () => void;
  navigateToLanding: () => Promise<unknown>;
  onError: (error: unknown) => void;
  setIsSigningOut: (value: boolean) => void;
};

export function createSignOut(deps: SignOutDeps): (reason?: SignOutReason) => Promise<void> {
  let inFlight: Promise<void> | null = null;
  let mustCompleteLocally = false;

  return function signOut(reason: SignOutReason = 'manual'): Promise<void> {
    if (reason === 'unauthorized') mustCompleteLocally = true;

    // Concurrent calls share this run instead of starting a new one —
    // see docs/auth.md for the race this avoids.
    if (inFlight) {
      return inFlight;
    }

    const run = async () => {
      deps.setIsSigningOut(true);
      try {
        try {
          await deps.prepare(reason);
        } catch (error) {
          if (!mustCompleteLocally) throw error;
        }
        await deps.firebaseSignOut();
        deps.clearQueryCache();
        await deps.navigateToLanding();
      } catch (error) {
        deps.onError(error);
      } finally {
        deps.setIsSigningOut(false);
        inFlight = null;
        mustCompleteLocally = false;
      }
    };

    inFlight = run();
    return inFlight;
  };
}
