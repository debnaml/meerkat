"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { SignOutButton } from "@/app/(dashboard)/sign-out-button";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  email: string;
}

export function UserMenu({ email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open, closeMenu]);

  useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, closeMenu]);

  function toggleMenu() {
    setOpen((previous) => !previous);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] px-3 py-1 text-xs font-semibold text-[var(--color-text-primary)] shadow-sm transition-colors hover:bg-[var(--color-surface-muted)]",
          open && "bg-[var(--color-surface-muted)]"
        )}
      >
        <span className="hidden sm:inline">{email}</span>
        <span className="sm:hidden">Account</span>
        <span className={cn("text-[var(--color-text-muted)] transition-transform", open && "rotate-180")}>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-3 shadow-xl"
        >
          <div className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            <p className="uppercase tracking-wide">Signed in as</p>
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{email}</p>
          </div>
          <div className="mt-3 space-y-1">
            <Link
              href="/settings"
              role="menuitem"
              onClick={closeMenu}
              className="block rounded-xl px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-muted)]"
            >
              Settings & preferences
            </Link>
            <div role="none" onClick={closeMenu}>
              <SignOutButton
                role="menuitem"
                variant="ghost"
                className="w-full justify-start rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-[var(--color-danger-ink)] hover:bg-[var(--color-danger-soft)]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
