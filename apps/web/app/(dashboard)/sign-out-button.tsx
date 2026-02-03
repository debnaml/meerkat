"use client";

import type { ComponentProps, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

interface SignOutButtonProps extends Omit<ButtonProps, "onClick"> {
  label?: ReactNode;
}

export function SignOutButton({
  className,
  label = "Sign out",
  variant = "ghost",
  ...props
}: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={pending}
      variant={variant}
      className={cn(
        "rounded-full border border-[var(--color-border-muted)] px-3 py-1 text-xs font-semibold",
        className
      )}
      {...props}
    >
      {pending ? "Signing out…" : label}
    </Button>
  );
}
