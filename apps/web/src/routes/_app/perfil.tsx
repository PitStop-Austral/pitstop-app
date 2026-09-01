import { createFileRoute } from '@tanstack/react-router';

import { Text } from '@/components/ui/text';

export const Route = createFileRoute('/_app/perfil')({
  component: ProfilePage,
});

function ProfilePage() {
  return <Text variant="title">Perfil</Text>;
}
