export const VEHICLE_ONBOARDING_STORAGE_PREFIX = 'pitstop:vehicle-onboarding:';

export function vehicleOnboardingStorageKey(userUid: string): string {
  return `${VEHICLE_ONBOARDING_STORAGE_PREFIX}${userUid}`;
}

export function hasSeenVehicleOnboarding(
  storage: Pick<Storage, 'getItem'>,
  userUid: string,
): boolean {
  try {
    return storage.getItem(vehicleOnboardingStorageKey(userUid)) !== null;
  } catch {
    return false;
  }
}

export function markVehicleOnboardingSeen(
  storage: Pick<Storage, 'setItem'>,
  userUid: string,
): void {
  try {
    storage.setItem(vehicleOnboardingStorageKey(userUid), 'true');
  } catch {
    // Some private browsing modes block local storage. The onboarding remains usable.
  }
}

export function shouldOfferVehicleOnboarding(input: {
  vehicleCount: number;
  alreadySeen: boolean;
}): boolean {
  return input.vehicleCount === 0 && !input.alreadySeen;
}
