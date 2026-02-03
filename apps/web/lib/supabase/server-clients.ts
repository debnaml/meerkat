import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClientOptions } from "@supabase/supabase-js";

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieOptions = Parameters<CookieStore["set"]>[2];

function ensurePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }

  return { url, anonKey };
}

function buildClient(cookieStore: CookieStore, options?: SupabaseClientOptions["global"]) {
  const { url, anonKey } = ensurePublicEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, cookieOptions?: CookieOptions) {
        cookieStore.set(name, value, cookieOptions);
      },
      remove(name: string) {
        cookieStore.delete(name);
      },
    },
    global: options,
  });
}

export async function getServerComponentClient(options?: SupabaseClientOptions["global"]) {
  const cookieStore = await cookies();
  return buildClient(cookieStore, options);
}

export async function getServerActionClient(options?: SupabaseClientOptions["global"]) {
  const cookieStore = await cookies();
  return buildClient(cookieStore, options);
}

export async function getRouteHandlerClient(cookieStore: CookieStore | Promise<CookieStore>, options?: SupabaseClientOptions["global"]) {
  const resolvedStore = await cookieStore;
  return buildClient(resolvedStore, options);
}
