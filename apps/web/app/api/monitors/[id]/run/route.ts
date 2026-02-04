import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { getRouteHandlerClient } from "@/lib/supabase/server-clients";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  const { data: monitor, error: monitorError } = await supabase
    .from("monitors")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (monitorError) {
    return NextResponse.json({ error: monitorError.message }, { status: 400 });
  }

  if (!monitor) {
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  const payload = {
    monitor_id: monitor.id,
    org_id: orgId,
    scheduled_for: new Date().toISOString(),
    attempts: 0,
    locked_at: null,
    lock_id: null,
    error_message: null,
  };

  const { error: enqueueError } = await supabase
    .from("pending_checks")
    .upsert(payload, { onConflict: "monitor_id" });

  if (enqueueError) {
    return NextResponse.json({ error: enqueueError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
