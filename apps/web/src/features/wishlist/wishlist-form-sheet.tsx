import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useCreateWishlistItem } from './queries';
import { PRIORITY_STYLES, WISHLIST_PRIORITIES } from './types';
import type { WishlistPriority } from './types';
import {
  INITIAL_WISHLIST_FORM_VALUES,
  getWishlistFormErrors,
  wishlistFormSchema,
} from './wishlist-form-schema';
import type { WishlistFormErrors, WishlistFormValues } from './wishlist-form-schema';

type WishlistFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
};

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

export function WishlistFormSheet({ open, onOpenChange, vehicleId }: WishlistFormSheetProps) {
  const formId = useId();
  const [values, setValues] = useState<WishlistFormValues>(INITIAL_WISHLIST_FORM_VALUES);
  const [errors, setErrors] = useState<WishlistFormErrors>({});
  const createItem = useCreateWishlistItem();
  const isPending = createItem.isPending;

  function updateField<Field extends keyof WishlistFormValues>(
    field: Field,
    value: WishlistFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const result = wishlistFormSchema.safeParse(values);
    if (!result.success) {
      setErrors(getWishlistFormErrors(result.error));
      return;
    }
    setErrors({});

    try {
      await createItem.mutateAsync({ vehicleId, input: result.data });
      onOpenChange(false);
      toast.success('Deseo agregado');
    } catch (error) {
      toast.error(
        isApiError(error) ? error.message : 'No pudimos guardar el deseo. Probá de nuevo.',
      );
    }
  }

  return (
    <BottomSheet
      description="Una mejora, accesorio o repuesto para tu vehículo"
      dismissible={!isPending}
      footer={
        <Button className="w-full gap-2" disabled={isPending} form={formId} type="submit">
          {isPending ? <Icon className="animate-spin" color="on-primary" name="Loader2" /> : null}
          <Text color="on-primary" variant="label">
            {isPending ? 'Guardando…' : 'Agregar a la lista'}
          </Text>
        </Button>
      }
      open={open}
      onOpenChange={onOpenChange}
      title="Agregar deseo"
    >
      <form
        aria-busy={isPending}
        className="space-y-4"
        id={formId}
        noValidate
        onSubmit={handleSubmit}
      >
        <FormField error={errors.name} id="wishlist-name" label="Nombre">
          <Input
            aria-describedby={errors.name ? 'wishlist-name-error' : undefined}
            aria-invalid={Boolean(errors.name)}
            autoFocus
            id="wishlist-name"
            maxLength={80}
            placeholder="Llantas deportivas rodado 17"
            value={values.name}
            onChange={(event) => updateField('name', event.target.value)}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            error={errors.estimatedPrice}
            id="wishlist-price"
            label="Precio estimado (opcional)"
          >
            <Input
              aria-describedby={errors.estimatedPrice ? 'wishlist-price-error' : undefined}
              aria-invalid={Boolean(errors.estimatedPrice)}
              id="wishlist-price"
              inputMode="decimal"
              placeholder="95000"
              value={values.estimatedPrice}
              onChange={(event) => updateField('estimatedPrice', event.target.value)}
            />
          </FormField>
          <FormField id="wishlist-priority" label="Prioridad">
            <Select
              value={values.priority}
              onValueChange={(value) => updateField('priority', value as WishlistPriority)}
            >
              <SelectTrigger id="wishlist-priority">
                <SelectValue>
                  {(value: WishlistPriority) => <PriorityOption priority={value} />}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WISHLIST_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    <PriorityOption priority={priority} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField error={errors.note} id="wishlist-note" label="Nota (opcional)">
          <Textarea
            aria-describedby={errors.note ? 'wishlist-note-error' : undefined}
            aria-invalid={Boolean(errors.note)}
            id="wishlist-note"
            maxLength={280}
            placeholder="Modelo negro mate"
            value={values.note}
            onChange={(event) => updateField('note', event.target.value)}
          />
        </FormField>
      </form>
    </BottomSheet>
  );
}

function PriorityOption({ priority }: { priority: WishlistPriority }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn('size-1.5 rounded-full', PRIORITY_STYLES[priority].dotClassName)} />
      <Text variant="label">{PRIORITY_STYLES[priority].label}</Text>
    </div>
  );
}
