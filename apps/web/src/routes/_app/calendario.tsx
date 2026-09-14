import { createFileRoute } from '@tanstack/react-router';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/layout/page-container';
import { Text } from '@/components/ui/text';

export const Route = createFileRoute('/_app/calendario')({
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <PageContainer>
      <Text variant="title">Calendario</Text>
      <div className="mt-8">
        <EmptyState
          description="Pronto vas a poder organizar y consultar tus mantenimientos."
          icon="CalendarDays"
          title="Esta función estará disponible próximamente"
        />
      </div>
    </PageContainer>
  );
}
