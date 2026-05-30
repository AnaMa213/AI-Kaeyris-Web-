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
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      className="border-border-chrome bg-surface-raised flex flex-col items-center gap-4 rounded-md border px-8 py-16 text-center"
    >
      <h2 className="font-display text-2xl">{title}</h2>
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
