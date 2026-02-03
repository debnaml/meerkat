import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase";
import { getRouteHandlerClient } from "@/lib/supabase/server-clients";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  orgName: z.string().min(2, "Organization name is required"),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, password, orgName } = parsed.data;
  const adminClient = getSupabaseAdminClient();

  const {
    data: userData,
    error: createUserError,
  } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createUserError || !userData.user) {
    return NextResponse.json(
      { error: createUserError?.message ?? "Failed to create account" },
      { status: 400 }
    );
  }

  let orgId: string | null = null;

  try {
    const { data: orgData, error: orgError } = await adminClient
      .from("orgs")
      .insert({ name: orgName })
      .select("id")
      .single();

    if (orgError || !orgData) {
      throw new Error(orgError?.message ?? "Could not create org");
    }

    orgId = orgData.id;

    const { error: updateMetadataError } = await adminClient.auth.admin.updateUserById(
      userData.user.id,
      {
        app_metadata: {
          org_id: orgId,
        },
      }
    );

    if (updateMetadataError) {
      throw new Error(updateMetadataError.message);
    }

    const { error: insertUserError } = await adminClient.from("users").insert({
      org_id: orgId,
      email,
      auth_user_id: userData.user.id,
      role: "owner",
    });

    if (insertUserError) {
      throw new Error(insertUserError.message);
    }

    await adminClient.from("subscriptions").insert({
      org_id: orgId,
      plan_id: "starter",
      status: "active",
    });
  } catch (error) {
    await adminClient.auth.admin.deleteUser(userData.user.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signup failed" },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const supabase = await getRouteHandlerClient(cookieStore);
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return NextResponse.json(
      { error: signInError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, orgId });
}
