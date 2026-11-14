import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export type OpsTenant = { id: string; name: string; slug: string; locked: boolean; planId: string; planName: string; status: string; expiresAt?: string; personCount: number; adminCount: number; storageBytes: number };
export type OpsSnapshot = { metrics: { tenantCount: number; userCount: number; revenue: number; storageBytes: number }; tenants: OpsTenant[]; audit: Array<{ id: number; action: string; entityType: string; createdAt: string }> };

export async function getOpsSnapshot(): Promise<OpsSnapshot> {
  if (!hasSupabaseConfig()) return { metrics: { tenantCount: 4, userCount: 7, revenue: 1_498_000, storageBytes: 184_000_000 }, tenants: [{ id: "tenant-demo-hong-viet", name: "Họ Nguyễn — Đà Nẵng", slug: "demo-hong-viet", locked: false, planId: "community", planName: "Đoàn viên", status: "active", personCount: 16, adminCount: 1, storageBytes: 42_000_000 }], audit: [] };
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SERVICE_ROLE_REQUIRED");
  const [tenants, profiles, payments, usage, audit] = await Promise.all([
    admin.from("tenants").select("id, name, slug, locked_at, subscriptions(plan_id, status, expires_at, plans(name)), usage_counters(person_count, admin_count, storage_bytes)").order("created_at", { ascending: false }).limit(500),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("payment_orders").select("amount").eq("status", "paid"),
    admin.from("usage_counters").select("storage_bytes"),
    admin.from("audit_logs").select("id, action, entity_type, created_at").order("created_at", { ascending: false }).limit(30)
  ]);
  if (tenants.error) throw tenants.error;
  const rows: OpsTenant[] = (tenants.data ?? []).map((row) => {
    const subscription = row.subscriptions as unknown as { plan_id: string; status: string; expires_at: string | null; plans: { name: string } | null } | null;
    const counter = row.usage_counters as unknown as { person_count: number; admin_count: number; storage_bytes: number } | null;
    return { id: row.id, name: row.name, slug: row.slug, locked: Boolean(row.locked_at), planId: subscription?.plan_id ?? "free", planName: subscription?.plans?.name ?? "Miễn phí", status: subscription?.status ?? "free", expiresAt: subscription?.expires_at ?? undefined, personCount: counter?.person_count ?? 0, adminCount: counter?.admin_count ?? 0, storageBytes: Number(counter?.storage_bytes ?? 0) };
  });
  return { metrics: { tenantCount: rows.length, userCount: profiles.count ?? 0, revenue: (payments.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0), storageBytes: (usage.data ?? []).reduce((sum, row) => sum + Number(row.storage_bytes), 0) }, tenants: rows, audit: (audit.data ?? []).map((row) => ({ id: Number(row.id), action: row.action, entityType: row.entity_type, createdAt: row.created_at })) };
}
