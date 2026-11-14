import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeVietnameseName } from "@/lib/domain/genealogy";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { addDemoPerson, changeDemoPersonLifecycle } from "@/lib/demo/store";
import { demoStoreErrorResponse } from "@/lib/demo/response";

const personSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  fullName: z.string().trim().min(2).max(150),
  gender: z.enum(["male", "female", "other"]),
  relation: z.enum(["parent", "spouse", "child"]).default("child"),
  anchorId: z.string().min(1).max(100).optional(),
  generation: z.number().int().min(1).max(99).optional(),
  parentId: z.string().min(1).max(100).optional(),
  relationshipType: z.enum(["biological", "adoptive", "step", "guardian"]).default("biological")
});

export async function POST(request: Request, context: { params: Promise<{ treeId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { treeId } = await context.params;
  const parsed = personSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dữ liệu thành viên không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
  if (!hasSupabaseConfig()) {
    const anchorId = parsed.data.anchorId ?? parsed.data.parentId;
    if (!anchorId) return NextResponse.json({ error: "Thành viên liên kết không hợp lệ." }, { status: 400 });
    try {
      const result = await addDemoPerson(treeId, { ...parsed.data, anchorId });
      return NextResponse.json({ ...result, demo: true }, { status: 201 });
    } catch (error) {
      return demoStoreErrorResponse(error);
    }
  }
  const anchorId = parsed.data.anchorId ?? parsed.data.parentId;
  if (!anchorId || !z.string().uuid().safeParse(anchorId).success) return NextResponse.json({ error: "Thành viên liên kết không hợp lệ." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("add_related_person_with_version", {
    p_tree_id: treeId,
    p_expected_version: parsed.data.expectedVersion,
    p_anchor_id: anchorId,
    p_relation: parsed.data.relation,
    p_full_name: parsed.data.fullName,
    p_search_name: normalizeVietnameseName(parsed.data.fullName),
    p_gender: parsed.data.gender,
    p_relationship_type: parsed.data.relationshipType
  });
  if (error?.code === "P0001" && error.message.includes("VERSION_CONFLICT")) {
    return NextResponse.json({ error: "Phả đồ đã thay đổi.", code: "VERSION_CONFLICT" }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: "Không thể thêm thành viên." }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

const lifecycleSchema = z.object({ personId: z.string().min(1).max(100), expectedVersion: z.number().int().nonnegative() });

async function lifecycle(request: Request, context: { params: Promise<{ treeId: string }> }, action: "archive" | "restore") {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { treeId } = await context.params;
  const parsed = lifecycleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) {
    try {
      const result = await changeDemoPersonLifecycle(treeId, parsed.data.personId, parsed.data.expectedVersion, action);
      return NextResponse.json({ ...result, demo: true });
    } catch (error) {
      return demoStoreErrorResponse(error);
    }
  }
  if (!z.string().uuid().safeParse(parsed.data.personId).success) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(action === "archive" ? "soft_delete_person_with_version" : "restore_person_with_version", { p_person_id: parsed.data.personId, p_expected_version: parsed.data.expectedVersion });
  if (error?.message.includes("VERSION_CONFLICT")) return NextResponse.json({ error: "Phả đồ đã thay đổi.", code: "VERSION_CONFLICT" }, { status: 409 });
  if (error?.message.includes("ROOT_PERSON")) return NextResponse.json({ error: "Hãy chọn người gốc khác trước khi xóa." }, { status: 409 });
  if (error?.message.includes("PERSON_HAS_CHILDREN")) return NextResponse.json({ error: "Hãy chuyển hoặc gỡ quan hệ con trước khi xóa." }, { status: 409 });
  if (error) return NextResponse.json({ error: action === "archive" ? "Không thể lưu trữ thành viên." : "Không thể phục hồi thành viên." }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request, context: { params: Promise<{ treeId: string }> }) {
  return lifecycle(request, context, "archive");
}

export async function PATCH(request: Request, context: { params: Promise<{ treeId: string }> }) {
  return lifecycle(request, context, "restore");
}
