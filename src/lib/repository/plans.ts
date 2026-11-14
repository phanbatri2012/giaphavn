import { PLANS } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getActivePlans(): Promise<Plan[]> {
  if (!hasSupabaseConfig()) return PLANS;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("plans").select("id, name, annual_price, member_limit, admin_limit, storage_limit_bytes").eq("active", true).order("sort_order");
  if (error || !data?.length) return PLANS;
  return data.filter((row) => ["free", "basic", "community"].includes(row.id)).map((row) => ({
    id: row.id as Plan["id"], name: row.name, annualPrice: Number(row.annual_price), personLimit: row.member_limit,
    adminLimit: row.admin_limit, storageLimitBytes: Number(row.storage_limit_bytes), highlighted: row.id === "community"
  }));
}

export type PaymentOrderSummary = { id: string; planName: string; amount: number; status: string; kind: string; createdAt: string; paidAt?: string };

export async function getPaymentOrders(tenantId: string): Promise<PaymentOrderSummary[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("payment_orders").select("id, amount, status, kind, created_at, paid_at, plans(name)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20);
  return (data ?? []).map((row) => ({ id: row.id, planName: (row.plans as unknown as { name: string } | null)?.name ?? "—", amount: Number(row.amount), status: row.status, kind: row.kind, createdAt: row.created_at, paidAt: row.paid_at ?? undefined }));
}
import "server-only";

