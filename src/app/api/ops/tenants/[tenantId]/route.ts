import { NextResponse } from "next/server";
import { z } from "zod";
import { getVerifiedOperator } from "@/lib/security/operator";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lock") }),
  z.object({ action: z.literal("unlock") }),
  z.object({ action: z.literal("activate"), planId: z.enum(["free", "basic", "community"]), days: z.number().int().min(1).max(1095).default(365) })
]);

export async function PATCH(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ updated: true, demo: true });
  const operator = await getVerifiedOperator();
  if (!operator) return NextResponse.json({ error: "Operator cần allowlist và MFA AAL2." }, { status: 403 });
  const { tenantId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(tenantId).success) return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role chưa được cấu hình." }, { status: 503 });

  if (parsed.data.action === "lock" || parsed.data.action === "unlock") {
    const { error } = await admin.from("tenants").update({ locked_at: parsed.data.action === "lock" ? new Date().toISOString() : null }).eq("id", tenantId);
    if (error) return NextResponse.json({ error: "Không thể cập nhật trạng thái tenant." }, { status: 400 });
    if (parsed.data.action === "lock") {
      await admin.from("subscriptions").update({ status: "locked" }).eq("tenant_id", tenantId);
    } else {
      const { data: subscription } = await admin.from("subscriptions").select("plan_id, expires_at").eq("tenant_id", tenantId).maybeSingle();
      const restoredStatus = subscription?.plan_id === "free" ? "free" : subscription?.expires_at && new Date(subscription.expires_at).getTime() > Date.now() ? "active" : "read_only";
      await admin.from("subscriptions").update({ status: restoredStatus }).eq("tenant_id", tenantId);
    }
  } else {
    const { data: current } = await admin.from("subscriptions").select("expires_at").eq("tenant_id", tenantId).maybeSingle();
    const base = Math.max(Date.now(), current?.expires_at ? new Date(current.expires_at).getTime() : 0);
    const expiresAt = parsed.data.planId === "free" ? null : new Date(base + parsed.data.days * 86400_000).toISOString();
    const { error } = await admin.from("subscriptions").upsert({ tenant_id: tenantId, plan_id: parsed.data.planId, status: parsed.data.planId === "free" ? "free" : "active", starts_at: new Date().toISOString(), expires_at: expiresAt });
    if (error) return NextResponse.json({ error: "Không thể cập nhật gói." }, { status: 400 });
  }
  await admin.from("audit_logs").insert({ tenant_id: tenantId, actor_user_id: operator.userId, action: `operator.${parsed.data.action}`, entity_type: "tenant", entity_id: tenantId, metadata: parsed.data });
  return NextResponse.json({ updated: true });
}
