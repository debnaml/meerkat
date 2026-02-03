import type { NextRequest } from "next/server";
import { describe, it, beforeEach, expect, vi } from "vitest";

import { POST } from "@/app/api/auth/signup/route";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getRouteHandlerClient } from "@/lib/supabase/server-clients";

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server-clients", () => ({
  getRouteHandlerClient: vi.fn(),
}));

const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: () => cookieStore,
}));

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedGetRouteHandlerClient = vi.mocked(getRouteHandlerClient);

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;
type RouteClient = Awaited<ReturnType<typeof getRouteHandlerClient>>;

let signInWithPassword = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  cookieStore.get = vi.fn();
  cookieStore.set = vi.fn();
  cookieStore.delete = vi.fn();

  signInWithPassword = vi.fn().mockResolvedValue({ error: null });
  const routeClientMock = { auth: { signInWithPassword } } as unknown as RouteClient;
  mockedGetRouteHandlerClient.mockResolvedValue(routeClientMock);
});

function buildRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as NextRequest;
}

function createAdminClientMock() {
  const createUser = vi.fn().mockResolvedValue({
    data: { user: { id: "user-123" } },
    error: null,
  });
  const updateUserById = vi.fn().mockResolvedValue({ error: null });
  const deleteUser = vi.fn().mockResolvedValue({});

  const orgSingle = vi.fn().mockResolvedValue({ data: { id: "org-123" }, error: null });
  const orgSelect = vi.fn().mockReturnValue({ single: orgSingle });
  const orgInsert = vi.fn().mockReturnValue({ select: orgSelect });

  const usersInsert = vi.fn().mockResolvedValue({ error: null });
  const subscriptionsInsert = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((table: string) => {
    switch (table) {
      case "orgs":
        return { insert: orgInsert };
      case "users":
        return { insert: usersInsert };
      case "subscriptions":
        return { insert: subscriptionsInsert };
      default:
        throw new Error(`Unhandled table mock: ${table}`);
    }
  });

  const client = {
    auth: {
      admin: {
        createUser,
        updateUserById,
        deleteUser,
      },
    },
    from,
  } as unknown as AdminClient;

  return {
    client,
    spies: {
      createUser,
      updateUserById,
      deleteUser,
      orgInsert,
      orgSelect,
      orgSingle,
      usersInsert,
      subscriptionsInsert,
    },
  };
}

describe("signup route", () => {
  const validBody = {
    email: "owner@example.com",
    password: "validPass123",
    orgName: "Example Org",
  };

  it("returns 400 for malformed payloads", async () => {
    const response = await POST(buildRequest({ email: "bad" }));
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBeTruthy();
    expect(mockedGetSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 when Supabase user creation fails", async () => {
    const { client, spies } = createAdminClientMock();
    spies.createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "supabase broke" },
    });

    mockedGetSupabaseAdminClient.mockReturnValue(client);

    const response = await POST(buildRequest(validBody));
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toContain("supabase broke");
    expect(spies.createUser).toHaveBeenCalledWith({
      email: validBody.email,
      password: validBody.password,
      email_confirm: true,
    });
  });

  it("creates the org, user profile, subscription, and signs the user in", async () => {
    const { client, spies } = createAdminClientMock();
    mockedGetSupabaseAdminClient.mockReturnValue(client);

    const response = await POST(buildRequest(validBody));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ success: true, orgId: "org-123" });

    expect(spies.orgInsert).toHaveBeenCalledWith({ name: validBody.orgName });
    expect(spies.usersInsert).toHaveBeenCalledWith({
      org_id: "org-123",
      email: validBody.email,
      auth_user_id: "user-123",
      role: "owner",
    });
    expect(spies.subscriptionsInsert).toHaveBeenCalledWith({
      org_id: "org-123",
      plan_id: "starter",
      status: "active",
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: validBody.email,
      password: validBody.password,
    });
  });

  it("rolls back the auth user when org creation fails", async () => {
    const { client, spies } = createAdminClientMock();
    spies.orgSingle.mockResolvedValueOnce({ data: null, error: { message: "db down" } });
    mockedGetSupabaseAdminClient.mockReturnValue(client);

    const response = await POST(buildRequest(validBody));
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error).toContain("db down");
    expect(spies.deleteUser).toHaveBeenCalledWith("user-123");
  });
});
