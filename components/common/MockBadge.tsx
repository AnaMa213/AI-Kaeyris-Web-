"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MockBadgeProps {
  /** Short label shown inside the badge. Default: "Mock". */
  label?: string;
  /** Explanatory text shown on hover/focus. */
  tooltip: string;
}

export function MockBadge({ label = "Mock", tooltip }: MockBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={tooltip}
        className="inline-flex cursor-help focus:outline-none"
      >
        <Badge variant="outline" className="uppercase tracking-wide">
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
