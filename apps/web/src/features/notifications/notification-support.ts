export type NotificationCapability =
  | 'supported'
  | 'denied'
  | 'unsupported'
  | 'ios-install-required';

type NavigatorIdentity = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>;

type NotificationEnvironment = {
  isIos: boolean;
  isStandalone: boolean;
  isSecureContext: boolean;
  hasNotificationApi: boolean;
  hasServiceWorkerApi: boolean;
  hasPushManagerApi: boolean;
  messagingSupported: boolean;
  permission: NotificationPermission;
  hasVapidKey: boolean;
};

export function isIosDevice(navigatorIdentity: NavigatorIdentity): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigatorIdentity.userAgent) ||
    (navigatorIdentity.platform === 'MacIntel' && navigatorIdentity.maxTouchPoints > 1)
  );
}

export function resolveNotificationCapability(
  environment: NotificationEnvironment,
): NotificationCapability {
  if (environment.isIos && !environment.isStandalone) return 'ios-install-required';

  if (
    !environment.isSecureContext ||
    !environment.hasNotificationApi ||
    !environment.hasServiceWorkerApi ||
    !environment.hasPushManagerApi ||
    !environment.messagingSupported ||
    !environment.hasVapidKey
  ) {
    return 'unsupported';
  }

  return environment.permission === 'denied' ? 'denied' : 'supported';
}
