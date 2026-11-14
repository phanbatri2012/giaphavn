import { NextResponse } from "next/server";
import { z } from "zod";
import { hashTreeAccessCode } from "@/lib/security/access-code";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateDemoTreeSettings } from "@/lib/demo/store";
import { demoStoreErrorResponse } from "@/lib/demo/response";

const updateSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  name: z.string().trim().min(2).max(120),
  rootPersonId: z.string().min(1).max(100),
  visibility: z.enum(["public", "protected"]),
  accessCode: z.string().min(4).max(100).optional()
});
const archiveSchema = z.object({ expectedVersion: z.number().int().nonnegative() });

export async function PATCH(request: Request, context: { params: Promise<{ treeId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { treeId } = await context.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thiết lập phả đồ không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) {
    if (parsed.data.visibility === "protected" && !process.env.DEMO_TREE_ACCESS_CODE) {
      return NextResponse.json({ error: "Hãy cấu hình DEMO_TREE_ACCESS_CODE trong .env.local trước khi bật mã bảo mật." }, { status: 400 });
    }
    try {
      return NextResponse.json({ ...await updateDemoTreeSettings(treeId, parsed.data), demo: true });
    } catch (error) {
      return demoStoreErrorResponse(error);
    }
  }
  const accessHash = parsed.data.accessCode ? await hashTreeAccessCode(parsed.data.accessCode) : null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_family_tree_settings", {
    p_tree_id: treeId,
    p_expected_version: parsed.data.expectedVersion,
    p_name: parsed.data.name,
    p_root_person_id: parsed.data.rootPersonId,
    p_visibility: parsed.data.visibility,
    p_access_code_hash: accessHash
  });
  if (error?.message.includes("VERSION_CONFLICT")) return NextResponse.json({ error: "Phả đồ đã thay đổi.", code: "VERSION_CONFLICT" }, { status: 409 });
  if (error?.message.includes("ACCESS_CODE_REQUIRED")) return NextResponse.json({ error: "Hãy nhập mã bảo mật khi bật chế độ protected." }, { status: 400 });
  if (error) return NextResponse.json({ error: "Không thể lưu thiết lập phả đồ." }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request, context: { params: Promise<{ treeId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { treeId } = await context.params;
  const parsed = archiveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ archived: true, demo: true });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("archive_family_tree", { p_tree_id: treeId, p_expected_version: parsed.data.expectedVersion });
  if (error?.message.includes("LAST_TREE")) return NextResponse.json({ error: "Không thể lưu trữ phả đồ cuối cùng." }, { status: 409 });
  if (error?.message.includes("VERSION_CONFLICT")) return NextResponse.json({ error: "Phả đồ đã thay đổi.", code: "VERSION_CONFLICT" }, { status: 409 });
  if (error) return NextResponse.json({ error: "Không thể lưu trữ phả đồ." }, { status: 400 });
  return NextResponse.json(data);
}
