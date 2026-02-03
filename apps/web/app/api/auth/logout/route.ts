import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getRouteHandlerClient } from "@/lib/supabase/server-clients";

export async function POST() {
  const cookieStore = await cookies();
  const supabase = await getRouteHandlerClient(cookieStore);
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
