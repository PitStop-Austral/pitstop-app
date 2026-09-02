import { createFileRoute } from '@tanstack/react-router';

import { Text } from '@/components/ui/text';

export const Route = createFileRoute('/')({
  component: IndexRoute,
});

function IndexRoute() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6">
      <Text variant="title">Inicio</Text>
    </div>
  );
}
