export type ServiceWorkerRegistrationCallbacks = {
  onRegistered: (registration: ServiceWorkerRegistration | undefined) => void;
  onError: (error: unknown) => void;
};

type ServiceWorkerRegistrationManagerOptions = {
  isSupported: () => boolean;
  start: (callbacks: ServiceWorkerRegistrationCallbacks) => void;
};

export function createServiceWorkerRegistrationManager(
  options: ServiceWorkerRegistrationManagerOptions,
) {
  let registrationPromise: Promise<ServiceWorkerRegistration> | undefined;

  function startRegistration(): Promise<ServiceWorkerRegistration> | undefined {
    if (!options.isSupported()) return undefined;
    if (registrationPromise) return registrationPromise;

    const attempt = new Promise<ServiceWorkerRegistration>((resolve, reject) => {
      options.start({
        onRegistered: (registration) => {
          if (registration) {
            resolve(registration);
          } else {
            reject(new Error('Service worker registration is unavailable'));
          }
        },
        onError: reject,
      });
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
