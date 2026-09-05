import { createFileRoute } from '@tanstack/react-router';

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
    <div className="p-4">
      <Text variant="title">Perfil</Text>

      <Button className="mt-6 w-full" variant="secondary" onClick={() => void signOut()}>
        <Icon className="mr-2" color="danger" name="LogOut" size="sm" />
        <Text color="danger" variant="label">
          Cerrar sesión
        </Text>
      </Button>
    </div>
  );
}
