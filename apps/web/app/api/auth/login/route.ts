import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { getRouteHandlerClient } from "@/lib/supabase/server-clients";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = await getRouteHandlerClient(cookieStore);
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 401 }
    );
  }

  return NextResponse.json({ success: true });
}
