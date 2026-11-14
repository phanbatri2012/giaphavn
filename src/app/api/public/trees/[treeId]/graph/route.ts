import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { demoTree } from "@/lib/demo/data";
import { toPublicPerson } from "@/lib/domain/genealogy";
import type { Person } from "@/lib/domain/types";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTreeAccessCookie } from "@/lib/security/access-code";
import { getDemoTree } from "@/lib/demo/store";

export async function GET(_: Request, context: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await context.params;
  if (!hasSupabaseConfig()) {
    if (treeId !== demoTree.id) return NextResponse.json({ error: "Không tìm thấy phả đồ." }, { status: 404 });
    const tree = await getDemoTree();
    return NextResponse.json({ id: tree.id, name: tree.name, graphVersion: tree.graphVersion, persons: tree.persons.map(toPublicPerson), unions: tree.unions, parentageLinks: tree.parentageLinks }, { headers: { "Cache-Control": "no-store" } });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Dịch vụ chưa được cấu hình." }, { status: 503 });
  const { data: tree } = await admin.from("family_trees").select("id, tenant_id, name, visibility, graph_version, archived_at, tenants!inner(published, locked_at, deletion_requested_at)").eq("id", treeId).maybeSingle();
  const tenant = tree?.tenants as unknown as { published: boolean; locked_at: string | null; deletion_requested_at: string | null } | null;
  if (!tree || tree.archived_at || !tenant?.published || tenant.locked_at || tenant.deletion_requested_at) return NextResponse.json({ error: "Không tìm thấy phả đồ." }, { status: 404 });
  if (tree.visibility === "protected") {
    const store = await cookies();
    if (!verifyTreeAccessCookie(treeId, store.get(`tree_access_${treeId}`)?.value)) return NextResponse.json({ error: "Phả đồ yêu cầu mã bảo mật.", code: "TREE_LOCKED" }, { status: 401 });
  }
  const [persons, unions, links] = await Promise.all([
    admin.from("persons").select("*").eq("tree_id", treeId).is("archived_at", null),
    admin.from("unions").select("id, tenant_id, tree_id, sort_order, union_partners(person_id)").eq("tree_id", treeId).is("archived_at", null),
    admin.from("parentage_links").select("*").eq("tree_id", treeId)
  ]);
  if (persons.error || unions.error || links.error) return NextResponse.json({ error: "Không thể tải phả đồ." }, { status: 500 });
  const publicPersons = (persons.data ?? []).map((row) => toPublicPerson({
    id: row.id, tenantId: row.tenant_id, treeId: row.tree_id, fullName: row.full_name, searchName: row.search_name,
    otherName: row.other_name ?? undefined, gender: row.gender, generation: row.generation, roleTitle: row.role_title ?? undefined,
    avatarUrl: row.avatar_url ?? undefined, birthDate: row.birth_date ? { value: row.birth_date, precision: row.birth_precision ?? "day", calendar: row.birth_calendar ?? "solar" } : undefined,
    deathDate: row.death_date ? { value: row.death_date, precision: row.death_precision ?? "day", calendar: row.death_calendar ?? "solar" } : undefined,
    isDeceased: row.is_deceased, phone: row.phone ?? undefined, email: row.email ?? undefined, address: row.address ?? undefined,
    biography: row.biography ?? undefined, publicFields: row.public_fields, sortOrder: row.sort_order
  } satisfies Person));
  return NextResponse.json({
    id: tree.id, name: tree.name, graphVersion: Number(tree.graph_version), persons: publicPersons,
    unions: (unions.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, treeId: row.tree_id, sortOrder: row.sort_order, partnerIds: (row.union_partners ?? []).map((item: { person_id: string }) => item.person_id) })),
    parentageLinks: (links.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, treeId: row.tree_id, parentId: row.parent_id, childId: row.child_id, unionId: row.union_id ?? undefined, relationshipType: row.relationship_type, sortOrder: row.sort_order }))
  }, { headers: { "Cache-Control": tree.visibility === "public" ? "public, s-maxage=60, stale-while-revalidate=300" : "private, no-store" } });
}
