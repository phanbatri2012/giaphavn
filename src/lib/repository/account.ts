import "server-only";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAccountSettings(tenantId: string) {
  if (!hasSupabaseConfig()) return { profile: { fullName: "Trần Anh Trí", email: "tri@example.vn" }, admins: [{ userId: "demo-owner", fullName: "Trần Anh Trí", role: "owner" as const }], invitations: [] as Array<{ id: string; email: string; expiresAt: string }>, mfaEnabled: false, deletionRequestedAt: undefined as string | undefined, purgeAfter: undefined as string | undefined };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("AUTH_REQUIRED");
  const [profile, memberships, invitations, factors, tenant] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle(),
    supabase.from("memberships").select("user_id, role, profiles(full_name)").eq("tenant_id", tenantId).order("created_at"),
    supabase.from("invitations").select("id, email, expires_at").eq("tenant_id", tenantId).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
    supabase.auth.mfa.listFactors(),
    supabase.from("tenants").select("deletion_requested_at, purge_after").eq("id", tenantId).maybeSingle()
  ]);
  return {
    profile: { fullName: profile.data?.full_name || String(auth.user.user_metadata?.full_name ?? ""), email: auth.user.email ?? "" },
    admins: (memberships.data ?? []).map((row) => ({ userId: row.user_id, role: row.role as "owner" | "admin", fullName: (row.profiles as unknown as { full_name: string } | null)?.full_name || "Quản trị viên" })),
    invitations: (invitations.data ?? []).map((row) => ({ id: row.id, email: row.email, expiresAt: row.expires_at })),
    mfaEnabled: (factors.data?.totp ?? []).some((factor) => factor.status === "verified"),
    deletionRequestedAt: tenant.data?.deletion_requested_at ?? undefined,
    purgeAfter: tenant.data?.purge_after ?? undefined
  };
}
