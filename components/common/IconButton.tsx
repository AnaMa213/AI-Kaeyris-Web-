"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ButtonProps = ComponentProps<typeof Button>;

interface IconButtonProps extends Omit<ButtonProps, "children" | "aria-label"> {
  /** Nom accessible ET texte du tooltip (source unique). */
  label: string;
  icon: ReactNode;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}

/**
 * Bouton icône avec tooltip conforme à la DA (Base UI Tooltip — le
 * `TooltipProvider` est global dans `app/layout.tsx`). Le `label` sert à la fois
 * de nom accessible (`aria-label`) et de contenu du tooltip.
 */
export function IconButton({
  label,
  icon,
  tooltipSide = "top",
  size = "icon-sm",
  variant = "ghost",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size={size}
            variant={variant}
            aria-label={label}
            {...props}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}
