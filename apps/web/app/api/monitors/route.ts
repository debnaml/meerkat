import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { BaselineCheckError, runBaselineCheck } from "@/lib/monitors/baseline-check";
import { getRouteHandlerClient } from "@/lib/supabase/server-clients";

const intervals = [15, 60, 360, 720, 1440];

const createMonitorSchema = z.object({
  name: z.string().min(2),
  url: z.string().url(),
  type: z.enum(["page", "section"]),
  interval_minutes: z.number().int().refine((value) => intervals.includes(value), {
    message: "Interval not allowed",
  }),
  sensitivity: z.enum(["strict", "normal", "relaxed"]),
  selector_css: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createMonitorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = await getRouteHandlerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = (user.app_metadata as { org_id?: string } | null)?.org_id;

  if (!orgId) {
    return NextResponse.json({ error: "Missing org" }, { status: 400 });
  }

  let baseline;
  try {
    baseline = await runBaselineCheck({
      url: parsed.data.url,
      mode: parsed.data.type,
      selector: parsed.data.type === "section" ? parsed.data.selector_css ?? null : null,
    });
  } catch (error) {
    if (error instanceof BaselineCheckError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("Baseline check failed", error);
    return NextResponse.json(
      { error: "Failed to verify the monitor target. Please try again." },
      { status: 500 }
    );
  }

  const nextCheckAt = addMinutes(baseline.fetchedAt, parsed.data.interval_minutes);

  const payload = {
    ...parsed.data,
    org_id: orgId,
    selector_css:
      parsed.data.type === "section" ? parsed.data.selector_css ?? null : null,
    last_status: "ok",
    last_checked_at: baseline.fetchedAt,
    last_success_at: baseline.fetchedAt,
    next_check_at: nextCheckAt,
  };

  const { data: monitorRecord, error: monitorError } = await supabase
    .from("monitors")
    .insert(payload)
    .select("id")
    .single();

  if (monitorError || !monitorRecord) {
    return NextResponse.json({ error: monitorError?.message ?? "Failed to create monitor" }, { status: 400 });
  }

  const { data: checkRecord, error: checkError } = await supabase
    .from("checks")
    .insert({
      monitor_id: monitorRecord.id,
      org_id: orgId,
      started_at: baseline.fetchedAt,
      finished_at: baseline.fetchedAt,
      status: "ok",
      http_status: baseline.httpStatus,
      content_hash: baseline.contentHash,
      extracted_text_bytes: baseline.textBytes,
      html_bytes: baseline.htmlBytes,
      final_url: baseline.finalUrl,
      error_message: null,
    })
    .select("id")
    .single();

  if (checkError || !checkRecord) {
    await supabase.from("monitors").delete().eq("id", monitorRecord.id);
    return NextResponse.json(
      { error: "Monitor saved but failed to store baseline check. Please try again." },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from("monitors")
    .update({ last_check_id: checkRecord.id })
    .eq("id", monitorRecord.id);

  if (updateError) {
    console.error("Failed to update monitor with baseline check", updateError);
  }

  return NextResponse.json({ success: true, monitor_id: monitorRecord.id });
}

function addMinutes(isoString: string, minutes: number) {
  const date = new Date(isoString);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}
