import { Button } from "@/components/ui/button";

type EmptyStateAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
};

interface EmptyStateProps {
  title: string;
  description: string;
  action?: EmptyStateAction;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className="border-border-chrome bg-surface-raised mx-auto my-16 flex max-w-120 flex-col items-center gap-3 rounded-md border px-6 py-10 text-center"
    >
      {icon && <div className="text-4xl leading-none">{icon}</div>}
      <h2 className="font-display text-xl">{title}</h2>
      <p className="text-text-chrome-muted font-sans text-sm">{description}</p>
      {action && (
        <Button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.disabled ? action.disabledHint : undefined}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
