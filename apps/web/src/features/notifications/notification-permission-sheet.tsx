import { useEffect, useRef, useState } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import type { ApiError } from '@/lib/api-client';
import { getOrCreateInstallationId } from './installation-id';
import { getNotificationCapability, getNotificationToken } from './messaging';
import type { NotificationCapability } from './notification-support';
import { useMarkNotificationPromptShown, useRegisterNotificationDevice } from './queries';

type NotificationPermissionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function errorMessage(error: unknown): string {
  const message = (error as Partial<ApiError> | null)?.message;
  return typeof message === 'string' ? message : 'No pudimos activar las notificaciones';
}

export function NotificationPermissionSheet({
  open,
  onOpenChange,
}: NotificationPermissionSheetProps) {
  const [capability, setCapability] = useState<NotificationCapability | 'checking'>('checking');
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const didMarkPrompt = useRef(false);
  const markPrompt = useMarkNotificationPromptShown();
  const registerDevice = useRegisterNotificationDevice();

  useEffect(() => {
    if (!open || didMarkPrompt.current) return;
    didMarkPrompt.current = true;
    markPrompt.mutate();
  }, [markPrompt, open]);

  useEffect(() => {
    let cancelled = false;

    void getNotificationCapability()
      .then((result) => {
        if (!cancelled) setCapability(result);
      })
      .catch(() => {
        if (!cancelled) setCapability('unsupported');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function close(): void {
    if (!isActivating) onOpenChange(false);
  }

  function handleActivate(): void {
    if (capability !== 'supported' || isActivating) return;

    setActivationError(null);
    setIsActivating(true);

    // Keep the permission request in the original click task. Safari can reject it after an await.
    const permissionRequest = Notification.requestPermission();

    void permissionRequest
      .then(async (permission) => {
        if (permission === 'denied') {
          setCapability('denied');
          return;
        }
        if (permission !== 'granted') {
          setActivationError('No se activaron las notificaciones. Podés volver a intentarlo.');
          return;
        }

        const token = await getNotificationToken();
        const installationId = getOrCreateInstallationId(window.localStorage);
        await registerDevice.mutateAsync({ installationId, token });
        toast.success('Notificaciones activadas');
        onOpenChange(false);
      })
      .catch((error: unknown) => {
        setActivationError(errorMessage(error));
      })
      .finally(() => {
        setIsActivating(false);
      });
  }

  const canActivate = capability === 'supported' && !isActivating;

  return (
    <BottomSheet
      dismissible={!isActivating}
      footer={
        <div className="grid gap-2.5">
          <Button className="w-full gap-2" disabled={!canActivate} onClick={handleActivate}>
            <Icon
              className={isActivating ? 'animate-spin' : undefined}
              color="on-primary"
              name={isActivating ? 'Loader2' : 'Bell'}
              size="sm"
            />
            <Text color="on-primary" variant="label">
              {isActivating ? 'Activando...' : 'Activar'}
            </Text>
          </Button>
          <Button className="w-full" disabled={isActivating} variant="secondary" onClick={close}>
            <Text variant="label">Ahora no</Text>
          </Button>
          <Text className="text-center" color="muted" variant="caption">
            Podrás activarlas después desde Perfil
          </Text>
        </div>
      }
      open={open}
      title="Activar notificaciones"
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="grid size-12 place-items-center rounded-full bg-red-50">
          <Icon color="primary" name="Bell" size="lg" />
        </div>
        <Text className="mt-4" color="muted" variant="body">
          Te avisaremos cuando un mantenimiento esté próximo o vencido.
        </Text>

        {capability === 'checking' ? (
          <Text className="mt-4" color="muted" variant="caption">
            Comprobando compatibilidad...
          </Text>
        ) : null}
        {capability === 'ios-install-required' ? (
          <Text className="mt-4" color="muted" variant="body">
            Para recibir notificaciones en iPhone o iPad, abrí Compartir, elegí “Agregar a inicio” y
            luego activalas desde la aplicación instalada.
          </Text>
        ) : null}
        {capability === 'unsupported' ? (
          <Text className="mt-4" color="muted" variant="body">
            Este navegador o su configuración actual no permite recibir notificaciones.
          </Text>
        ) : null}
        {capability === 'denied' ? (
          <Text className="mt-4" color="muted" variant="body">
            El permiso está bloqueado. Podés habilitarlo desde los ajustes del navegador o del
            dispositivo.
          </Text>
        ) : null}
        {activationError ? (
          <Text className="mt-4" color="danger" variant="caption">
            {activationError}
          </Text>
        ) : null}
      </div>
    </BottomSheet>
  );
}
