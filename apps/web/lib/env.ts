import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DEV_ORG_ID: z.string().uuid(),
});

let cachedEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv() {
  if (!cachedEnv) {
    cachedEnv = serverEnvSchema.parse({
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      DEV_ORG_ID: process.env.DEV_ORG_ID,
    });
  }

  return cachedEnv;
}
