import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variantClasses = {
  primary: "bg-[var(--color-brand)] text-[var(--color-text-on-brand)] hover:bg-[var(--color-brand-strong)]",
  secondary: "bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]",
  ghost: "bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]",
  danger: "bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-strong)]",
  subtle: "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] hover:bg-[var(--color-surface-hover)]",
  successSubtle: "bg-[var(--color-success-soft)] text-[var(--color-success-ink)] hover:bg-[var(--color-success-soft-strong)]",
  dangerOutline: "border border-[var(--color-danger-soft)] text-[var(--color-danger-ink)] hover:bg-[var(--color-danger-soft)]",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", fullWidth = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
          variantClasses[variant],
          fullWidth && "w-full",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
