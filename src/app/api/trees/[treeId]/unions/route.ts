import { NextResponse } from "next/server";
import { z } from "zod";
import { demoTree } from "@/lib/demo/data";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const schema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  partnerIds: z.array(z.string()).min(1).max(2),
  childIds: z.array(z.string()).max(500).default([]),
  relationshipType: z.enum(["biological", "adoptive", "step", "guardian"]).default("biological")
});

export async function POST(request: Request, context: { params: Promise<{ treeId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { treeId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || new Set(parsed.data?.partnerIds).size !== parsed.data?.partnerIds.length) return NextResponse.json({ error: "Quan hệ hôn phối không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) {
    if (treeId !== demoTree.id) return NextResponse.json({ error: "Không tìm thấy phả đồ." }, { status: 404 });
    if (parsed.data.expectedVersion !== demoTree.graphVersion) return NextResponse.json({ error: "Phả đồ đã thay đổi.", code: "VERSION_CONFLICT" }, { status: 409 });
    return NextResponse.json({ id: crypto.randomUUID(), graphVersion: demoTree.graphVersion + 1, demo: true }, { status: 201 });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_union_with_version", { p_tree_id: treeId, p_expected_version: parsed.data.expectedVersion, p_partner_ids: parsed.data.partnerIds, p_child_ids: parsed.data.childIds, p_relationship_type: parsed.data.relationshipType });
  if (error?.message.includes("VERSION_CONFLICT")) return NextResponse.json({ error: "Phả đồ đã thay đổi.", code: "VERSION_CONFLICT" }, { status: 409 });
  if (error) return NextResponse.json({ error: "Không thể tạo quan hệ hôn phối." }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
