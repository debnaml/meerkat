"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface AuthFormProps {
  variant: "login" | "signup";
}

export function AuthForm({ variant }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirectTo") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const endpoint = variant === "login" ? "/api/auth/login" : "/api/auth/signup";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "Something went wrong");
        setPending(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          name="email"
          required
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
          placeholder="••••••••"
        />
      </div>
      {variant === "signup" && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Organization name</label>
          <input
            type="text"
            name="orgName"
            required
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            placeholder="Acme Monitoring"
          />
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600">{typeof error === "string" ? error : "Something went wrong"}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Please wait…" : variant === "login" ? "Log in" : "Create account"}
      </button>
    </form>
  );
}
