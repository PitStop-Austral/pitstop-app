import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { AuthFormError, PasswordStrength } from '@/components/auth/auth-feedback';
import { PasswordField } from '@/components/auth/auth-fields';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import {
  mapChangePasswordError,
  validateChangePassword,
  type ChangePasswordErrors,
  type ChangePasswordField,
  type ChangePasswordValues,
} from '@/lib/auth-forms';
import { useAuth } from '@/lib/auth-context';

type ChangePasswordSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const initialValues: ChangePasswordValues = {
  currentPassword: '',
  newPassword: '',
  passwordConfirmation: '',
};

export function ChangePasswordSheet({ open, onOpenChange }: ChangePasswordSheetProps) {
  const formId = useId();
  const { changePassword } = useAuth();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [formError, setFormError] = useState<string>();
  const [formKey, setFormKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  function resetForm(): void {
    setValues(initialValues);
    setErrors({});
    setFormError(undefined);
    setFormKey((current) => current + 1);
  }

  function handleOpenChange(nextOpen: boolean): void {
    if (isSubmitting) return;
    resetForm();
    onOpenChange(nextOpen);
  }

  function updateValue(field: ChangePasswordField, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSubmitting || isSubmittingRef.current) return;

    const validationErrors = validateChangePassword(values);
    setErrors(validationErrors);
    setFormError(undefined);
    if (Object.keys(validationErrors).length > 0) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      resetForm();
      onOpenChange(false);
      toast.success('Contraseña actualizada');
    } catch (error: unknown) {
      const mappedError = mapChangePasswordError(error);
      if (mappedError.target === 'field') {
        setErrors({ [mappedError.field]: mappedError.message });
        if (mappedError.field === 'currentPassword') {
          setValues((current) => ({ ...current, currentPassword: '' }));
        }
        return;
      }

      setFormError(mappedError.message);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <BottomSheet
      description="Para cambiarla, primero confirmá la actual."
      dismissible={!isSubmitting}
      footer={
        <Button className="w-full" disabled={isSubmitting} form={formId} type="submit">
          <Text color="on-primary" variant="label">
            {isSubmitting ? 'Guardando…' : 'Cambiar contraseña'}
          </Text>
        </Button>
      }
      open={open}
      title="Cambiar contraseña"
      onOpenChange={handleOpenChange}
    >
      <form aria-busy={isSubmitting} id={formId} noValidate onSubmit={handleSubmit}>
        <div className="space-y-4" key={formKey}>
          <PasswordField
            autoComplete="current-password"
            disabled={isSubmitting}
            error={errors.currentPassword}
            id="current-password"
            label="Contraseña actual"
            placeholder="Contraseña actual"
            value={values.currentPassword}
            onChange={(event) => updateValue('currentPassword', event.target.value)}
          />
          <div>
            <PasswordField
              autoComplete="new-password"
              disabled={isSubmitting}
              error={errors.newPassword}
              id="new-password"
              label="Nueva contraseña"
              placeholder="Nueva contraseña"
              value={values.newPassword}
              onChange={(event) => updateValue('newPassword', event.target.value)}
            />
            <PasswordStrength password={values.newPassword} />
          </div>
          <PasswordField
            autoComplete="new-password"
            disabled={isSubmitting}
            error={errors.passwordConfirmation}
            id="confirm-password"
            label="Repetí la nueva contraseña"
            placeholder="Repetí la nueva contraseña"
            value={values.passwordConfirmation}
            onChange={(event) => updateValue('passwordConfirmation', event.target.value)}
          />
          {formError ? <AuthFormError message={formError} /> : null}
        </div>
      </form>
    </BottomSheet>
  );
}
