import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { EmptyState } from '@/components/empty-state';
import { Odometer } from '@/components/odometer';
import { StatusChip } from '@/components/status-chip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text, type TextColor, type TextVariant } from '@/components/ui/text';

export const Route = createFileRoute('/ui')({ component: UiGallery });

const variants: TextVariant[] = [
  'display',
  'title',
  'heading',
  'subheading',
  'card-title',
  'body',
  'body-strong',
  'label',
  'caption',
  'caption-strong',
  'overline',
  'numeric',
];
const colors: TextColor[] = [
  'default',
  'muted',
  'subtle',
  'emphasis',
  'primary',
  'on-primary',
  'inverse',
  'success',
  'warning',
  'danger',
];
const iconSizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[20px] border border-border bg-card p-5 shadow-card">
      <Text as="h2" variant="heading">
        {title}
      </Text>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function UiGallery() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-background p-4 sm:p-8">
      <div className="mb-8">
        <Text as="h1" variant="title">
          Galería temporal de componentes
        </Text>
        <Text className="mt-2" color="muted" variant="body">
          PIT-23 · Pantalla interna de verificación, no forma parte del producto.
        </Text>
      </div>
      <div className="grid gap-6">
        <Section title="Text">
          <div className="grid gap-4">
            {variants.map((variant) => (
              <div className="flex flex-wrap items-baseline gap-4" key={variant}>
                <Text className="w-32" color="muted" variant="caption">
                  {variant}
                </Text>
                <Text variant={variant}>Texto de ejemplo</Text>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Icon">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {colors.map((color) => (
              <div
                className={
                  color === 'on-primary' || color === 'inverse'
                    ? 'rounded-xl bg-foreground p-3'
                    : 'rounded-xl bg-neutral-100 p-3'
                }
                key={color}
              >
                <Text color={color} variant="caption">
                  {color}
                </Text>
                <div className="mt-3 flex items-center gap-2">
                  {iconSizes.map((size) => (
                    <Icon color={color} key={size} name="Wrench" size={size} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Controles">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-3">
              <Text variant="label">Campos</Text>
              <Input placeholder="Patente del vehículo" />
              <Input disabled placeholder="Campo deshabilitado" />
              <Select aria-label="Tipo de combustible" defaultValue="nafta">
                <option value="nafta">Nafta</option>
                <option value="diesel">Diésel</option>
              </Select>
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={checked}
                  onChange={(event) => setChecked(event.target.checked)}
                />
                <Text variant="label">Recordarme este mantenimiento</Text>
              </label>
            </div>
            <div className="flex flex-wrap content-start gap-3">
              <Button>
                <Text color="on-primary" variant="label">
                  Primario
                </Text>
              </Button>
              <Button variant="secondary">
                <Text variant="label">Secundario</Text>
              </Button>
              <Button variant="ghost">
                <Text variant="label">Ghost</Text>
              </Button>
              <Button variant="destructive">
                <Text color="danger" variant="label">
                  Eliminar
                </Text>
              </Button>
              <Button aria-label="Agregar" size="icon" variant="icon">
                <Icon color="muted" name="Plus" size="sm" />
              </Button>
              <Button
                onClick={() =>
                  toast(
                    <Text color="inverse" variant="label">
                      Mantenimiento guardado
                    </Text>,
                  )
                }
              >
                <Text color="on-primary" variant="label">
                  Probar toast
                </Text>
              </Button>
            </div>
          </div>
        </Section>
        <Section title="Estados y navegación">
          <div className="flex flex-wrap gap-3">
            <StatusChip status="current" />
            <StatusChip status="upcoming" />
            <StatusChip status="overdue" />
            <Badge>
              <Text variant="caption-strong">3 pendientes</Text>
            </Badge>
            <Badge variant="primary">
              <Text color="primary" variant="caption-strong">
                Vencido
              </Text>
            </Badge>
          </div>
          <Tabs defaultValue="historial">
            <TabsList>
              <TabsTrigger value="historial">
                <Text variant="label">Historial</Text>
              </TabsTrigger>
              <TabsTrigger value="proximos">
                <Text color="muted" variant="label">
                  Próximos
                </Text>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="historial">
              <Text variant="body">Último cambio de aceite: hace 3 meses.</Text>
            </TabsContent>
            <TabsContent value="proximos">
              <Text variant="body">Servicio recomendado en 1.000 km.</Text>
            </TabsContent>
          </Tabs>
        </Section>
        <Section title="Componentes propios">
          <div className="grid items-start gap-6 md:grid-cols-2">
            <div>
              <Text color="muted" variant="overline">
                Odómetro
              </Text>
              <Odometer value={145000} />
            </div>
            <EmptyState
              action={
                <Button>
                  <Text color="on-primary" variant="label">
                    Agregar vehículo
                  </Text>
                </Button>
              }
              description="Cuando agregues vehículos, los vas a ver acá."
              icon="Car"
              title="Todavía no tenés vehículos"
            />
          </div>
        </Section>
        <Section title="Overlay">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setSheetOpen(true)}>
              <Text color="on-primary" variant="label">
                Abrir BottomSheet
              </Text>
            </Button>
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              <Text variant="label">Abrir diálogo</Text>
            </Button>
          </div>
        </Section>
      </div>
      <BottomSheet
        footer={
          <Button className="w-full" onClick={() => setSheetOpen(false)}>
            <Text color="on-primary" variant="label">
              Entendido
            </Text>
          </Button>
        }
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Programar mantenimiento"
        description="Así se ve la hoja inferior en celular y el modal en desktop."
      >
        <Text variant="body">Probá cerrarla con Escape, la X, el fondo o este botón.</Text>
      </BottomSheet>
      <Dialog
        className="m-auto rounded-[24px] bg-card p-6 shadow-overlay backdrop:bg-neutral-900/40"
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >
        <Text as="h2" variant="heading">
          Diálogo de ejemplo
        </Text>
        <Text className="mt-2" color="muted" variant="body">
          Este estado se controla localmente en la galería temporal.
        </Text>
        <Button className="mt-5" onClick={() => setDialogOpen(false)}>
          <Text color="on-primary" variant="label">
            Cerrar
          </Text>
        </Button>
      </Dialog>
    </main>
  );
}
