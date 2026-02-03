import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase";

const monitorRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string(),
  type: z.enum(["page", "section", "visual"]),
  interval_minutes: z.number().int().positive(),
  last_status: z.string().nullable(),
  last_checked_at: z.string().nullable(),
  last_change_at: z.string().nullable(),
});

export type MonitorSummary = z.infer<typeof monitorRowSchema>;

export async function getLatestMonitors(limit = 5): Promise<MonitorSummary[]> {
  const supabase = getSupabaseAdminClient();
  const { DEV_ORG_ID } = getServerEnv();

  const { data, error } = await supabase
    .from("monitors")
    .select(
      "id, name, url, type, interval_minutes, last_status, last_checked_at, last_change_at"
    )
    .eq("org_id", DEV_ORG_ID)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch monitors: ${error.message}`);
  }

  const result = monitorRowSchema.array().safeParse(data ?? []);

  if (!result.success) {
    throw new Error("Monitor data failed validation");
  }

  return result.data;
}
