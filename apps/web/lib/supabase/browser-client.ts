"use client";

import { createBrowserClient, type SupabaseClient } from "@supabase/ssr";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_* env vars");
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
