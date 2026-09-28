import { useId } from 'react';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { OTHER_SERVICE } from './service-catalog';
import type { ServiceFieldValue } from './service-catalog';
import { ServiceSelector } from './service-selector';

type ServiceFieldProps = {
  value: ServiceFieldValue;
  onChange: (value: ServiceFieldValue) => void;
  error?: string;
  disabledValues?: string[];
};

export function ServiceField({ value, onChange, error, disabledValues }: ServiceFieldProps) {
  const customNameId = useId();
  const errorId = useId();
  const isCustomService = value.option === OTHER_SERVICE;

  return (
    <div>
      <Text as="div" className="mb-2" variant="label">
        Servicio
      </Text>
      <ServiceSelector
        aria-describedby={error && !isCustomService ? errorId : undefined}
        disabledValues={disabledValues}
        error={Boolean(error) && !isCustomService}
        value={value.option}
        onChange={(option) =>
          onChange({
            option,
            customName: option === OTHER_SERVICE ? value.customName : '',
          })
        }
      />
      {isCustomService ? (
        <div className="mt-3">
          <Text as="label" htmlFor={customNameId} variant="label">
            Nombre del mantenimiento
          </Text>
          <Input
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error) || undefined}
            autoFocus
            className="mt-2"
            id={customNameId}
            maxLength={60}
            placeholder="Ej. Revisión de dirección"
            value={value.customName}
            onChange={(event) => onChange({ ...value, customName: event.target.value })}
          />
        </div>
      ) : null}
      {error ? (
        <Text className="mt-1.5" color="danger" id={errorId} variant="caption-strong">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
