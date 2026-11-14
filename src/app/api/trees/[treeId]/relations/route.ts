import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { linkDemoPeople, removeDemoRelation } from "@/lib/demo/store";
import { demoStoreErrorResponse } from "@/lib/demo/response";

const linkSchema = z.object({ expectedVersion: z.number().int().nonnegative(), parentId: z.string().min(1), childId: z.string().min(1), relationshipType: z.enum(["biological", "adoptive", "step", "guardian"]) });
const removeSchema = z.object({ expectedVersion: z.number().int().nonnegative(), kind: z.enum(["parentage", "union"]), id: z.string().min(1) });

export async function POST(request: Request, context: { params: Promise<{ treeId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { treeId } = await context.params;
  const parsed = linkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.parentId === parsed.data.childId) return NextResponse.json({ error: "Quan hệ không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) {
    try {
      return NextResponse.json(await linkDemoPeople(treeId, parsed.data), { status: 201 });
    } catch (error) {
      return demoStoreErrorResponse(error);
    }
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("link_people_with_version", { p_tree_id: treeId, p_expected_version: parsed.data.expectedVersion, p_parent_id: parsed.data.parentId, p_child_id: parsed.data.childId, p_relationship_type: parsed.data.relationshipType });
  if (error?.message.includes("VERSION_CONFLICT")) return NextResponse.json({ error: "Phả đồ đã thay đổi.", code: "VERSION_CONFLICT" }, { status: 409 });
  if (error?.message.includes("GENEALOGY_CYCLE")) return NextResponse.json({ error: "Quan hệ này sẽ tạo chu trình trong phả đồ." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Không thể tạo quan hệ." }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: Request, context: { params: Promise<{ treeId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { treeId } = await context.params;
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Quan hệ không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) {
    try {
      return NextResponse.json(await removeDemoRelation(treeId, parsed.data));
    } catch (error) {
      return demoStoreErrorResponse(error);
    }
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(parsed.data.kind === "parentage" ? "remove_parentage_link_with_version" : "remove_union_with_version", parsed.data.kind === "parentage" ? { p_link_id: parsed.data.id, p_expected_version: parsed.data.expectedVersion } : { p_union_id: parsed.data.id, p_expected_version: parsed.data.expectedVersion });
  if (error?.message.includes("VERSION_CONFLICT")) return NextResponse.json({ error: "Phả đồ đã thay đổi.", code: "VERSION_CONFLICT" }, { status: 409 });
  if (error) return NextResponse.json({ error: "Không thể gỡ quan hệ." }, { status: 400 });
  return NextResponse.json(data);
}
