import { createFileRoute } from '@tanstack/react-router';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth-context';

export const Route = createFileRoute('/_app/perfil')({
  component: ProfilePage,
});

function ProfilePage() {
  const { signOut } = useAuth();

  return (
    <PageContainer>
      <Text variant="title">Perfil</Text>

      <div className="mt-8">
        <EmptyState
          description="Pronto vas a poder ver y editar tu información."
          icon="UserRound"
          title="Esta función estará disponible próximamente"
        />
      </div>

      <Button className="mt-8 w-full" variant="secondary" onClick={() => void signOut()}>
        <Icon className="mr-2" color="danger" name="LogOut" size="sm" />
        <Text color="danger" variant="label">
          Cerrar sesión
        </Text>
      </Button>
    </PageContainer>
  );
}
