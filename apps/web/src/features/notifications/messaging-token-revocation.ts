type MessagingTokenRevocationDependencies = {
  isSupported: () => Promise<boolean>;
  getRegistration: () => Promise<ServiceWorkerRegistration>;
  bindTokenToRegistration: (registration: ServiceWorkerRegistration) => Promise<unknown>;
  deleteToken: () => Promise<unknown>;
};

export async function revokeMessagingToken({
  isSupported,
  getRegistration,
  bindTokenToRegistration,
  deleteToken,
}: MessagingTokenRevocationDependencies): Promise<void> {
  if (!(await isSupported())) return;

  const registration = await getRegistration();
  await bindTokenToRegistration(registration);
  await deleteToken();
}
