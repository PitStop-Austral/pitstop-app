import { createFileRoute } from '@tanstack/react-router';

import { Text } from '@/components/ui/text';

export const Route = createFileRoute('/_app/')({
  component: HomePage,
});

function HomePage() {
  return <Text variant="title">Inicio</Text>;
}
