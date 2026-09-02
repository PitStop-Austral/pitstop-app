import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

type AuthSubmitButtonProps = {
  busyLabel: string;
  disabled: boolean;
  idleLabel: string;
};

export function AuthSubmitButton({ busyLabel, disabled, idleLabel }: AuthSubmitButtonProps) {
  return (
    <Button
      className="h-[52px] w-full focus-visible:outline-3 focus-visible:outline-primary/50"
      disabled={disabled}
      type="submit"
    >
      {disabled ? (
        <Icon className="mr-2 animate-spin" color="on-primary" name="Loader2" size="sm" />
      ) : null}
      <Text color="on-primary" variant="label">
        {disabled ? busyLabel : idleLabel}
      </Text>
    </Button>
  );
}
