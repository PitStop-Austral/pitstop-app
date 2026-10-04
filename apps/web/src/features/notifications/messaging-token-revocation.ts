type MessagingTokenRevocationDependencies<TMessaging> = {
  isSupported: () => Promise<boolean>;
  getRegistration: () => Promise<ServiceWorkerRegistration>;
  getMessaging: () => TMessaging;
  bindTokenToRegistration: (
    messaging: TMessaging,
    registration: ServiceWorkerRegistration,
  ) => Promise<unknown>;
  deleteToken: (messaging: TMessaging) => Promise<unknown>;
};

export async function revokeMessagingToken<TMessaging>({
  isSupported,
  getRegistration,
  getMessaging,
  bindTokenToRegistration,
  deleteToken,
}: MessagingTokenRevocationDependencies<TMessaging>): Promise<void> {
  if (!(await isSupported())) return;

  const registration = await getRegistration();
  const messaging = getMessaging();
  await bindTokenToRegistration(messaging, registration);
  await deleteToken(messaging);
}
