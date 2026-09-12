import { createFileRoute } from '@tanstack/react-router';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/layout/page-container';
import { Text } from '@/components/ui/text';

export const Route = createFileRoute('/_app/')({
  component: HomePage,
});

function HomePage() {
  return (
    <PageContainer>
      <Text variant="title">Inicio</Text>
      <div className="mt-8">
        <EmptyState
          description="Pronto vas a poder ver el resumen de tus mantenimientos y recordatorios."
          icon="House"
          title="Esta función estará disponible próximamente"
        />
      </div>
    </PageContainer>
  );
}
