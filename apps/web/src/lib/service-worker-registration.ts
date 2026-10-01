import { registerSW } from 'virtual:pwa-register';
import { createServiceWorkerRegistrationManager } from './service-worker-registration-core';

const registrationManager = createServiceWorkerRegistrationManager({
  isSupported: () => 'serviceWorker' in navigator,
  start: ({ onRegistered, onError }) => {
    registerSW({
      immediate: true,
      onRegisteredSW: (_serviceWorkerUrl, registration) => onRegistered(registration),
      onRegisterError: onError,
    });
  },
});

export function registerAppServiceWorker(): void {
  registrationManager.register();
}

export function getAppServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  return registrationManager.getRegistration();
}
