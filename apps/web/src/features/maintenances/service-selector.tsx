import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { normalizeServiceType, SERVICE_OPTIONS } from './service-catalog';
import type { ServiceOptionName } from './service-catalog';
import { ServiceIcon } from './service-icon';

type ServiceSelectorProps = {
  value: string;
  onChange: (value: ServiceOptionName) => void;
  error?: boolean;
  disabledValues?: string[];
  'aria-describedby'?: string;
};

export function ServiceSelector({
  value,
  onChange,
  error = false,
  disabledValues = [],
  'aria-describedby': ariaDescribedBy,
}: ServiceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const normalizedDisabledValues = new Set(disabledValues.map(normalizeServiceType));

  const closeAndFocusTrigger = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !isOpen) return;

    event.preventDefault();
    event.stopPropagation();
    closeAndFocusTrigger();
  };

  return (
    <div onKeyDown={handleKeyDown}>
      <button
        aria-controls={listboxId}
        aria-describedby={ariaDescribedBy}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-invalid={error || undefined}
        aria-label={`Servicio: ${value}`}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 rounded-[14px] border bg-card px-3 text-left outline-none transition focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10',
          error ? 'border-primary' : 'border-border hover:border-neutral-400',
        )}
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
      >
        <ServiceIcon className="bg-background" size="sm" type={value} />
        <Text as="span" className="min-w-0 flex-1 truncate" variant="body-strong">
          {value}
        </Text>
        <Icon
          className={cn('transition-transform', isOpen && 'rotate-180')}
          color="subtle"
          name="ChevronDown"
          size="sm"
        />
      </button>

      {isOpen ? (
        <div
          aria-label="Servicios disponibles"
          className="no-scrollbar mt-2 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-border bg-background p-2"
          id={listboxId}
          role="listbox"
        >
          {SERVICE_OPTIONS.map((option) => {
            const normalizedName = normalizeServiceType(option.name);
            const isDisabled = normalizedDisabledValues.has(normalizedName);
            const isSelected = normalizeServiceType(value) === normalizedName;

            return (
              <button
                aria-disabled={isDisabled}
                aria-selected={isSelected}
                className={cn(
                  'flex min-h-14 items-center gap-2 rounded-md border p-2 text-left outline-none transition-colors focus-visible:ring-4 focus-visible:ring-primary/10',
                  isDisabled
                    ? 'cursor-not-allowed border-border bg-neutral-100 opacity-70 active:scale-100'
                    : isSelected
                      ? 'border-foreground bg-foreground'
                      : 'border-border bg-card hover:border-neutral-400',
                )}
                key={option.name}
                role="option"
                type="button"
                onClick={() => {
                  if (isDisabled) return;
                  onChange(option.name);
                  closeAndFocusTrigger();
                }}
              >
                <ServiceIcon className="bg-card" size="xs" type={option.name} />
                <div className="min-w-0">
                  <Text
                    as="span"
                    className="block"
                    color={isDisabled ? 'subtle' : isSelected ? 'inverse' : 'emphasis'}
                    variant="caption-strong"
                  >
                    {option.name}
                  </Text>
                  {isDisabled ? (
                    <Text as="span" className="mt-0.5 block" color="subtle" variant="caption">
                      Ya creada
                    </Text>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
