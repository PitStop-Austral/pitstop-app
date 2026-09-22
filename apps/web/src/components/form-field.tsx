import type { ReactNode } from 'react';

import { Text } from '@/components/ui/text';

type FormFieldProps = {
  children: ReactNode;
  className?: string;
  error?: string;
  id: string;
  label: string;
};

export function FormField({ children, className, error, id, label }: FormFieldProps) {
  return (
    <div className={className}>
      <Text as="label" className="mb-2 block" color="emphasis" htmlFor={id} variant="label">
        {label}
      </Text>
      {children}
      {error ? (
        <Text className="mt-1.5 block" color="danger" id={`${id}-error`} variant="caption">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
