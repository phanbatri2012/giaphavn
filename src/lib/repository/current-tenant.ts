import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoTenant } from "@/lib/demo/data";
import type { FamilyTree } from "@/lib/domain/types";
import { PLANS } from "@/lib/domain/plans";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEditableTree } from "@/lib/repository/trees";
import { getDemoTree } from "@/lib/demo/store";

export const TENANT_CONTEXT_COOKIE = "giaphavn_tenant";
export const TREE_CONTEXT_COOKIE = "giaphavn_tree";

export type DashboardContext = {
  tenants: Array<{ id: string; name: string; shortName: string; slug: string }>;
  currentTenant: { id: string; name: string; shortName: string; slug: string };
  trees: Array<{ id: string; name: string }>;
  currentTreeId: string;
  subscription: {
    planName: string;
    planId: "free" | "basic" | "community";
    status: "free" | "pending" | "active" | "read_only" | "locked";
    expiresAt?: string;
    daysRemaining?: number;
    memberLimit: number;
    personCount: number;
  };
  user: { name: string; initials: string };
  isPlatformAdmin: boolean;
};

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(-2).map((part) => part.charAt(0).toUpperCase()).join("") || "GP";
}

function demoContext(tree: FamilyTree): DashboardContext {
  const plan = PLANS.find((item) => item.id === "community") ?? PLANS[0];
  return {
    tenants: [{ id: demoTenant.id, name: demoTenant.name, shortName: demoTenant.shortName, slug: demoTenant.slug }],
    currentTenant: { id: demoTenant.id, name: demoTenant.name, shortName: demoTenant.shortName, slug: demoTenant.slug },
    trees: [{ id: tree.id, name: tree.name }],
    currentTreeId: tree.id,
    subscription: { planName: plan.name, planId: plan.id, status: "active", expiresAt: "2027-06-01T00:00:00.000Z", daysRemaining: 202, memberLimit: plan.personLimit, personCount: tree.persons.length },
    user: { name: "Trần Anh Trí", initials: "TA" },
    isPlatformAdmin: true
  };
}

export async function getDashboardContext(): Promise<DashboardContext> {
  if (!hasSupabaseConfig()) return demoContext(await getDemoTree());
  const supabase = await createSupabaseServerClient();
  const [{ data: auth }, { data: memberships }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("memberships").select("tenant_id, tenants(id, slug, name, short_name)").order("created_at")
  ]);
  if (!auth.user) redirect("/dang-nhap");
  if (!memberships?.length) redirect("/tao-dong-ho");

  const tenants = memberships.flatMap((membership) => {
    const tenant = membership.tenants as unknown as { id: string; slug: string; name: string; short_name: string } | null;
    return tenant ? [{ id: tenant.id, slug: tenant.slug, name: tenant.name, shortName: tenant.short_name }] : [];
  });
  if (!tenants.length) redirect("/tao-dong-ho");

  const store = await cookies();
  const requestedTenantId = store.get(TENANT_CONTEXT_COOKIE)?.value;
  const currentTenant = tenants.find((tenant) => tenant.id === requestedTenantId) ?? tenants[0];
  const { data: treeRows } = await supabase
    .from("family_trees")
    .select("id, name")
    .eq("tenant_id", currentTenant.id)
    .is("archived_at", null)
    .order("created_at");
  const trees = (treeRows ?? []).map((tree) => ({ id: tree.id, name: tree.name }));
  if (!trees.length) redirect("/tao-dong-ho");
  const requestedTreeId = store.get(TREE_CONTEXT_COOKIE)?.value;
  const currentTree = trees.find((tree) => tree.id === requestedTreeId) ?? trees[0];

  const [{ data: subscription }, { data: usage }, { data: platformAdmin }] = await Promise.all([
    supabase.from("subscriptions").select("plan_id, status, expires_at, plans(name, member_limit)").eq("tenant_id", currentTenant.id).maybeSingle(),
    supabase.from("usage_counters").select("person_count").eq("tenant_id", currentTenant.id).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle()
  ]);
  const plan = subscription?.plans as unknown as { name: string; member_limit: number } | null;
  const displayName = String(auth.user.user_metadata?.full_name ?? auth.user.user_metadata?.name ?? auth.user.email?.split("@")[0] ?? "Quản trị viên");

  return {
    tenants,
    currentTenant,
    trees,
    currentTreeId: currentTree.id,
    subscription: {
      planName: plan?.name ?? "Miễn phí",
      planId: (subscription?.plan_id ?? "free") as "free" | "basic" | "community",
      status: subscription?.status ?? "free",
      expiresAt: subscription?.expires_at ?? undefined,
      daysRemaining: subscription?.expires_at ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / 86400_000)) : undefined,
      memberLimit: Number(plan?.member_limit ?? 50),
      personCount: Number(usage?.person_count ?? 0)
    },
    user: { name: displayName, initials: initials(displayName) },
    isPlatformAdmin: Boolean(platformAdmin)
  };
}

export async function getCurrentTenantId() {
  return (await getDashboardContext()).currentTenant.id;
}

export async function getCurrentTree(): Promise<FamilyTree> {
  if (!hasSupabaseConfig()) return getDemoTree();
  const context = await getDashboardContext();
  const tree = await getEditableTree(context.currentTreeId);
  if (!tree) redirect("/tao-dong-ho");
  return tree;
}
