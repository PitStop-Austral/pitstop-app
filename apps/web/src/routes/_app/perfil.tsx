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
import { Text } from '@/components/ui/text';
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
              <StatCard count={summaryQuery.data.vehicleCount} labels={['Vehículo', 'Vehículos']} />
              <StatCard count={summaryQuery.data.serviceCount} labels={['Servicio', 'Servicios']} />
            </div>
          </div>
        )}
      </div>

      {currentUserQuery.data ? (
        <EditNameSheet
          currentName={currentUserQuery.data.name}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      ) : null}
    </PageContainer>
  );
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
