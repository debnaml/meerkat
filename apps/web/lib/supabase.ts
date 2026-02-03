import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });

  return cachedClient;
}
