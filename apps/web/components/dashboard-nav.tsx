"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [{ href: "/dashboard", label: "Monitors" }];

export function DashboardNav() {
  const pathname = usePathname();

  if (links.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 rounded-full border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)] p-1 text-sm">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-full px-4 py-1 font-medium transition-colors",
              isActive
                ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
