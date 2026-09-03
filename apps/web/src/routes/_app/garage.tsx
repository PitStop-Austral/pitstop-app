import { createFileRoute } from '@tanstack/react-router';

import { Text } from '@/components/ui/text';

export const Route = createFileRoute('/_app/garage')({
  component: GaragePage,
});

function GaragePage() {
  return <Text variant="title">Garage</Text>;
}
