import { createFileRoute } from '@tanstack/react-router';

import { Text } from '@/components/ui/text';

export const Route = createFileRoute('/_app/calendario')({
  component: CalendarPage,
});

function CalendarPage() {
  return <Text variant="title">Calendario</Text>;
}
