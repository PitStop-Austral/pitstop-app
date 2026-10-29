export type ServiceWorkerRegistrationCallbacks = {
  onRegistered: (registration: ServiceWorkerRegistration | undefined) => void;
  onError: (error: unknown) => void;
};

type ServiceWorkerRegistrationManagerOptions = {
  isSupported: () => boolean;
  start: (callbacks: ServiceWorkerRegistrationCallbacks) => void;
  timeoutMs?: number;
};

const DEFAULT_REGISTRATION_TIMEOUT_MS = 10_000;

export function createServiceWorkerRegistrationManager(
  options: ServiceWorkerRegistrationManagerOptions,
) {
  let registrationPromise: Promise<ServiceWorkerRegistration> | undefined;

  function startRegistration(): Promise<ServiceWorkerRegistration> | undefined {
    if (!options.isSupported()) return undefined;
    if (registrationPromise) return registrationPromise;

    const attempt = new Promise<ServiceWorkerRegistration>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        settle(reject, new Error('Service worker registration timed out'));
      }, options.timeoutMs ?? DEFAULT_REGISTRATION_TIMEOUT_MS);

      function settle<Value>(callback: (value: Value) => void, value: Value): void {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback(value);
      }

      try {
        options.start({
          onRegistered: (registration) => {
            if (registration) {
              settle(resolve, registration);
            } else {
              settle(reject, new Error('Service worker registration is unavailable'));
            }
          },
          onError: (error) => settle(reject, error),
        });
      } catch (error) {
        settle(reject, error);
      }
    });
    registrationPromise = attempt;

    void attempt.catch(() => {
      if (registrationPromise === attempt) registrationPromise = undefined;
    });

    return attempt;
  }

  return {
    register(): void {
      void startRegistration()?.catch(() => undefined);
    },
    getRegistration(): Promise<ServiceWorkerRegistration> {
      return (
        startRegistration() ??
        Promise.reject(new Error('Service worker registration is unavailable'))
      );
    },
  };
}
