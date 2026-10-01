export const INSTALLATION_ID_STORAGE_KEY = 'pitstop:notification-installation-id';

type InstallationStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function getStoredInstallationId(storage: Pick<Storage, 'getItem'>): string | null {
  return storage.getItem(INSTALLATION_ID_STORAGE_KEY);
}

export function getOrCreateInstallationId(
  storage: InstallationStorage,
  createId: () => string = () => crypto.randomUUID(),
): string {
  const existing = getStoredInstallationId(storage);
  if (existing) return existing;

  const installationId = createId();
  storage.setItem(INSTALLATION_ID_STORAGE_KEY, installationId);
  return installationId;
}
