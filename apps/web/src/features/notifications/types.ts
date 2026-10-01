export type RegisterNotificationDeviceInput = {
  installationId: string;
  token: string;
};

export type RegisteredNotificationDevice = {
  id: string;
  installationId: string;
};
