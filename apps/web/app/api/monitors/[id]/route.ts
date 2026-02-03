import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { MONITOR_INTERVALS, MONITOR_SENSITIVITIES } from "@/lib/monitors/constants";
import { getRouteHandlerClient } from "@/lib/supabase/server-clients";

const updateSchema = z
  .object({
    name: z.string().min(2).optional(),
    url: z.string().url().optional(),
    interval_minutes: z
      .number()
      .int()
      .refine((value) => MONITOR_INTERVALS.includes(value), "Invalid interval")
      .optional(),
    sensitivity: z.enum(MONITOR_SENSITIVITIES).optional(),
    enabled: z.boolean().optional(),
    type: z.enum(["page", "section"]).optional(),
    selector_css: z.string().min(1).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Must include at least one field",
  })
  .refine(
    (data) => {
      if (data.type === "section") {
        return typeof data.selector_css === "string" && data.selector_css.trim().length > 0;
      }
      return true;
    },
    {
      message: "CSS selector is required for section monitors",
      path: ["selector_css"],
    }
  );

function normalizeSelector(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updates: Record<string, unknown> = {};

  if (data.name !== undefined) {
    updates.name = data.name;
  }
  if (data.url !== undefined) {
    updates.url = data.url;
  }
  if (data.interval_minutes !== undefined) {
    updates.interval_minutes = data.interval_minutes;
  }
  if (data.sensitivity !== undefined) {
    updates.sensitivity = data.sensitivity;
  }
  if (data.enabled !== undefined) {
    updates.enabled = data.enabled;
  }
  if (data.type !== undefined) {
    updates.type = data.type;
    updates.selector_css = data.type === "section" ? normalizeSelector(data.selector_css) : null;
  } else if (data.selector_css !== undefined) {
    updates.selector_css = normalizeSelector(data.selector_css);
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

  const { id } = await params;

  const { error } = await supabase
    .from("monitors")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
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

  const { error } = await supabase
    .from("monitors")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
