import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Icon className="animate-spin" color="primary" name="Loader2" size="lg" />
        <Text color="muted" variant="body">
          Cargando…
        </Text>
      </div>
    </div>
  );
}
