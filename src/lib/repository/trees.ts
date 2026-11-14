import { demoTree } from "@/lib/demo/data";
import type { FamilyTree, Person } from "@/lib/domain/types";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function partialDateValue(value: string, precision: "year" | "month" | "day") {
  return precision === "year" ? value.slice(0, 4) : precision === "month" ? value.slice(0, 7) : value.slice(0, 10);
}

type DbPersonRow = {
  id: string; tenant_id: string; tree_id: string; full_name: string; search_name: string; other_name: string | null;
  gender: Person["gender"]; generation: number; role_title: string | null; avatar_url: string | null; birth_date: string | null;
  birth_precision: "year" | "month" | "day" | null; birth_calendar: "solar" | "lunar" | null; death_date: string | null;
  death_precision: "year" | "month" | "day" | null; death_calendar: "solar" | "lunar" | null; is_deceased: boolean;
  phone: string | null; email: string | null; address: string | null; education: string | null; religion: string | null;
  biography: string | null; public_fields: Person["publicFields"]; sort_order: number; archived_at: string | null;
};

function mapPerson(row: DbPersonRow): Person {
  return {
    id: row.id, tenantId: row.tenant_id, treeId: row.tree_id, fullName: row.full_name, searchName: row.search_name,
    otherName: row.other_name ?? undefined, gender: row.gender, generation: row.generation, roleTitle: row.role_title ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    birthDate: row.birth_date ? { value: partialDateValue(row.birth_date, row.birth_precision ?? "day"), precision: row.birth_precision ?? "day", calendar: row.birth_calendar ?? "solar" } : undefined,
    deathDate: row.death_date ? { value: partialDateValue(row.death_date, row.death_precision ?? "day"), precision: row.death_precision ?? "day", calendar: row.death_calendar ?? "solar" } : undefined,
    isDeceased: row.is_deceased, phone: row.phone ?? undefined, email: row.email ?? undefined, address: row.address ?? undefined,
    education: row.education ?? undefined, religion: row.religion ?? undefined, biography: row.biography ?? undefined,
    publicFields: row.public_fields, sortOrder: row.sort_order, archivedAt: row.archived_at ?? undefined
  };
}

export async function getArchivedPeople(treeId: string): Promise<Person[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("persons").select("*").eq("tree_id", treeId).not("archived_at", "is", null).gt("purge_after", new Date().toISOString()).order("archived_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => mapPerson(row));
}

export async function getEditableTree(treeId: string): Promise<FamilyTree | null> {
  if (!hasSupabaseConfig()) return treeId === demoTree.id ? structuredClone(demoTree) : null;
  const supabase = await createSupabaseServerClient();
  const { data: tree, error } = await supabase.from("family_trees").select("id, tenant_id, name, root_person_id, visibility, graph_version").eq("id", treeId).is("archived_at", null).maybeSingle();
  if (error || !tree) return null;
  const [persons, unions, links] = await Promise.all([
    supabase.from("persons").select("*").eq("tree_id", treeId).is("archived_at", null).order("sort_order"),
    supabase.from("unions").select("id, tenant_id, tree_id, sort_order, union_partners(person_id)").eq("tree_id", treeId).is("archived_at", null),
    supabase.from("parentage_links").select("*").eq("tree_id", treeId).order("sort_order")
  ]);
  if (persons.error || unions.error || links.error) return null;
  const activePersonIds = new Set((persons.data ?? []).map((row) => row.id));
  return {
    id: tree.id, tenantId: tree.tenant_id, name: tree.name, rootPersonId: tree.root_person_id,
    visibility: tree.visibility, graphVersion: Number(tree.graph_version),
    persons: (persons.data ?? []).map((row) => mapPerson(row)),
    unions: (unions.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, treeId: row.tree_id, sortOrder: row.sort_order, partnerIds: (row.union_partners ?? []).map((item: { person_id: string }) => item.person_id) })).filter((union) => union.partnerIds.length > 0 && union.partnerIds.every((id) => activePersonIds.has(id))),
    parentageLinks: (links.data ?? []).map((row) => ({ id: row.id, tenantId: row.tenant_id, treeId: row.tree_id, parentId: row.parent_id, childId: row.child_id, unionId: row.union_id ?? undefined, relationshipType: row.relationship_type, sortOrder: row.sort_order })).filter((link) => activePersonIds.has(link.parentId) && activePersonIds.has(link.childId))
  };
}
