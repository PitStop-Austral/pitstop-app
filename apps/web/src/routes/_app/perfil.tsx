import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { ChangePasswordSheet } from '@/features/users/change-password-sheet';
import { getStoredInstallationId } from '@/features/notifications/installation-id';
import {
  getNotificationCapability,
  getNotificationToken,
} from '@/features/notifications/messaging';
import { NotificationPermissionSheet } from '@/features/notifications/notification-permission-sheet';
import {
  resolveNotificationToggleAction,
  type NotificationCapabilityState,
} from '@/features/notifications/notification-preferences';
import {
  useRegisterNotificationDevice,
  useUpdateNotificationPreferences,
} from '@/features/notifications/queries';
import { useCurrentUser, useProfileSummary, useUpdateMe } from '@/features/users/queries';
import { useAuth } from '@/lib/auth-context';

export const Route = createFileRoute('/_app/perfil')({
  component: ProfilePage,
});

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((word) => word.match(/\p{L}/u)?.[0])
    .filter((letter): letter is string => Boolean(letter))
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('es-AR');

  return initials || 'PS';
}

function ProfilePage() {
  const { signOut } = useAuth();
  const currentUserQuery = useCurrentUser();
  const summaryQuery = useProfileSummary();
  const [editorOpen, setEditorOpen] = useState(false);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);

  const isInitialLoading = currentUserQuery.isPending || summaryQuery.isPending;
  const hasLoadingError = currentUserQuery.isLoadingError || summaryQuery.isLoadingError;

  function retry() {
    void Promise.all([currentUserQuery.refetch(), summaryQuery.refetch()]);
  }

  return (
    <PageContainer className="max-w-2xl px-4 pt-5 pb-8 lg:max-w-[1200px] lg:px-8 lg:pt-8">
      <div className="space-y-7">
        <div>
          <Text variant="title">Perfil</Text>
          <Text className="mt-1" color="muted" variant="body">
            Preferencias, accesos y configuración de PitStop
          </Text>
        </div>

        {hasLoadingError ? (
          <EmptyState
            action={
              <Button variant="secondary" onClick={retry}>
                <Text variant="label">Reintentar</Text>
              </Button>
            }
            description="Revisá tu conexión y volvé a intentar."
            icon="AlertCircle"
            title="No pudimos cargar tu perfil"
          />
        ) : isInitialLoading || !currentUserQuery.data || !summaryQuery.data ? (
          <ProfileSkeleton />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <section className="relative rounded-[20px] border border-border bg-card p-5 shadow-sm">
                <Button
                  aria-label="Cerrar sesión"
                  className="absolute top-3 right-3 size-11 bg-transparent hover:bg-red-50"
                  size="icon"
                  variant="ghost"
                  onClick={() => void signOut()}
                >
                  <Icon color="danger" name="LogOut" size="md" />
                </Button>

                <div className="flex items-center gap-4 pr-10">
                  <div className="grid size-16 shrink-0 place-items-center rounded-full bg-primary">
                    <Text color="on-primary" variant="heading">
                      {getInitials(currentUserQuery.data.name)}
                    </Text>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Text className="truncate" variant="subheading">
                        {currentUserQuery.data.name}
                      </Text>
                      <Button
                        aria-label="Editar nombre"
                        className="shrink-0"
                        size="icon"
                        variant="icon"
                        onClick={() => setEditorOpen(true)}
                      >
                        <Icon color="muted" name="Pencil" size="sm" />
                      </Button>
                    </div>
                    <Text className="mt-1 break-all" color="muted" variant="body">
                      {currentUserQuery.data.email}
                    </Text>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  count={summaryQuery.data.vehicleCount}
                  labels={['Vehículo', 'Vehículos']}
                />
                <StatCard
                  count={summaryQuery.data.serviceCount}
                  labels={['Servicio', 'Servicios']}
                />
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2 lg:gap-x-8">
              <NotificationSettings
                notificationsEnabled={currentUserQuery.data.notificationsEnabled}
                onOpenPermissionSheet={() => setPermissionSheetOpen(true)}
              />
              <AccountSettings onChangePassword={() => setPasswordSheetOpen(true)} />
            </div>
          </>
        )}
      </div>

      {currentUserQuery.data ? (
        <EditNameSheet
          currentName={currentUserQuery.data.name}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      ) : null}
      <ChangePasswordSheet open={passwordSheetOpen} onOpenChange={setPasswordSheetOpen} />
      <NotificationPermissionSheet
        open={permissionSheetOpen}
        onOpenChange={setPermissionSheetOpen}
      />
    </PageContainer>
  );
}

function AccountSettings({ onChangePassword }: { onChangePassword: () => void }) {
  return (
    <section className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <Text color="muted" variant="overline">
        Cuenta y app
      </Text>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <button
          className="flex w-full items-center gap-3 p-4 text-left hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          type="button"
          onClick={onChangePassword}
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100">
            <Icon color="emphasis" name="Lock" size="md" strokeWidth={1.75} />
          </div>
          <Text color="default" variant="label">
            Cambiar contraseña
          </Text>
          <Icon className="ml-auto" color="subtle" name="ChevronRight" size="md" />
        </button>
      </div>
    </section>
  );
}

function NotificationSettings({
  notificationsEnabled,
  onOpenPermissionSheet,
}: {
  notificationsEnabled: boolean;
  onOpenPermissionSheet: () => void;
}) {
  const [capability, setCapability] = useState<NotificationCapabilityState>('checking');
  const [isActivatingCurrentDevice, setIsActivatingCurrentDevice] = useState(false);
  const registerDevice = useRegisterNotificationDevice();
  const updatePreferences = useUpdateNotificationPreferences();

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

  const isIosInstallRequired = capability === 'ios-install-required';
  const isSupported = capability === 'supported';
  const checked = notificationsEnabled && isSupported;
  const isSaving =
    isActivatingCurrentDevice || registerDevice.isPending || updatePreferences.isPending;
  const disabled = capability === 'checking' || !isSupported || isSaving;

  async function disableNotifications(): Promise<void> {
    try {
      await updatePreferences.mutateAsync(false);
    } catch {
      toast.error('No pudimos guardar el cambio. Probá de nuevo.');
    }
  }

  async function registerCurrentDevice(installationId: string): Promise<void> {
    if (isActivatingCurrentDevice) return;
    setIsActivatingCurrentDevice(true);
    try {
      const token = await getNotificationToken();
      await registerDevice.mutateAsync({ installationId, token });
    } catch {
      toast.error('No pudimos guardar el cambio. Probá de nuevo.');
    } finally {
      setIsActivatingCurrentDevice(false);
    }
  }

  function handleCheckedChange(nextChecked: boolean): void {
    const installationId = getStoredInstallationId(window.localStorage);
    const action = resolveNotificationToggleAction({
      capability,
      hasInstallationId: Boolean(installationId),
      nextChecked,
      permission: isSupported ? Notification.permission : null,
    });

    switch (action) {
      case 'disable-account':
        void disableNotifications();
        break;
      case 'open-permission-sheet':
        onOpenPermissionSheet();
        break;
      case 'register-current-device':
        if (installationId) void registerCurrentDevice(installationId);
        break;
      case 'unavailable':
        break;
    }
  }

  function openIosHelp(): void {
    if (isIosInstallRequired) onOpenPermissionSheet();
  }

  const description = getNotificationDescription(capability);

  return (
    <section className="space-y-3">
      <Text color="muted" variant="overline">
        Notificaciones
      </Text>
      <div className="relative flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card p-4">
        {isIosInstallRequired ? (
          <button
            aria-label="Cómo instalar PitStop para recibir alertas"
            className="absolute inset-0 z-10 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            type="button"
            onClick={openIosHelp}
          />
        ) : null}
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100">
          <Icon color="emphasis" name="Bell" size="md" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <Text color="default" variant="label">
            Alertas push
          </Text>
          <Text className="mt-0.5 block lg:truncate" color="muted" variant="caption">
            {description}
          </Text>
        </div>
        <Switch
          aria-label="Alertas push"
          checked={checked}
          className={isIosInstallRequired ? 'pointer-events-none' : undefined}
          disabled={disabled}
          onCheckedChange={handleCheckedChange}
        />
      </div>
    </section>
  );
}

function getNotificationDescription(capability: NotificationCapabilityState): string {
  switch (capability) {
    case 'denied':
      return 'Bloqueaste las notificaciones en este navegador. Habilitalas desde la configuración del sitio.';
    case 'unsupported':
      return 'Este navegador no permite notificaciones.';
    case 'ios-install-required':
      return 'Instalá PitStop en tu pantalla de inicio para recibir alertas.';
    default:
      return 'Recordatorios de mantenimientos próximos';
  }
}

function StatCard({ count, labels }: { count: number; labels: readonly [string, string] }) {
  return (
    <div className="flex flex-col justify-center rounded-[16px] border border-border bg-card p-4 text-center">
      <Text as="span" className="tabular-nums" variant="title">
        {count.toLocaleString('es-AR')}
      </Text>
      <Text className="mt-1" color="muted" variant="caption">
        {count === 1 ? labels[0] : labels[1]}
      </Text>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex items-center gap-4 rounded-[20px] border border-border bg-card p-5 shadow-sm">
        <div className="size-16 shrink-0 animate-pulse rounded-full bg-neutral-100" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-6 w-40 max-w-full animate-pulse rounded-full bg-neutral-100" />
          <div className="h-5 w-56 max-w-full animate-pulse rounded-full bg-neutral-100" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-h-26 animate-pulse rounded-[16px] border border-border bg-neutral-100" />
        <div className="min-h-26 animate-pulse rounded-[16px] border border-border bg-neutral-100" />
      </div>
    </div>
  );
}

function EditNameSheet({
  currentName,
  open,
  onOpenChange,
}: {
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const formId = useId();
  const updateMe = useUpdateMe();
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setName(currentName);
    setError(undefined);

    const frame = window.requestAnimationFrame(() => {
      const input = document.getElementById('profile-name');
      if (input instanceof HTMLInputElement) input.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentName, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (updateMe.isPending) return;
    setError(undefined);
    updateMe.reset();
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Ingresá tu nombre');
      return;
    }

    setError(undefined);
    try {
      await updateMe.mutateAsync({ name: trimmedName });
      onOpenChange(false);
      toast.success('Nombre actualizado');
    } catch {
      setError('No pudimos guardar el cambio. Probá de nuevo.');
    }
  }

  return (
    <BottomSheet
      description="Así te vamos a mostrar en PitStop."
      dismissible={!updateMe.isPending}
      footer={
        <Button className="w-full" disabled={updateMe.isPending} form={formId} type="submit">
          <Text color="on-primary" variant="label">
            {updateMe.isPending ? 'Guardando…' : 'Guardar'}
          </Text>
        </Button>
      }
      open={open}
      title="Editar nombre"
      onOpenChange={handleOpenChange}
    >
      <form aria-busy={updateMe.isPending} id={formId} noValidate onSubmit={handleSubmit}>
        <FormField error={error} id="profile-name" label="Nombre">
          <Input
            aria-describedby={error ? 'profile-name-error' : undefined}
            aria-invalid={Boolean(error)}
            disabled={updateMe.isPending}
            id="profile-name"
            maxLength={60}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(undefined);
              updateMe.reset();
            }}
          />
        </FormField>
      </form>
    </BottomSheet>
  );
}
