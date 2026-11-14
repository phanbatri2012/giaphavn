import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeVietnameseName } from "@/lib/domain/genealogy";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  rootPersonName: z.string().trim().min(2).max(150),
  rootPersonGender: z.enum(["male", "female", "other"]).default("male")
});

export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { tenantId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin phả đồ không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ treeId: crypto.randomUUID(), rootPersonId: crypto.randomUUID(), graphVersion: 1, demo: true }, { status: 201 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_family_tree", {
    p_tenant_id: tenantId,
    p_name: parsed.data.name,
    p_root_name: parsed.data.rootPersonName,
    p_root_search_name: normalizeVietnameseName(parsed.data.rootPersonName),
    p_root_gender: parsed.data.rootPersonGender
  });
  if (error?.message.includes("TREE_LIMIT")) return NextResponse.json({ error: "Mỗi dòng họ được tạo tối đa 5 phả đồ." }, { status: 409 });
  if (error?.message.includes("MEMBER_LIMIT")) return NextResponse.json({ error: "Gói hiện tại đã hết hạn mức thành viên." }, { status: 409 });
  if (error?.message.includes("TENANT_READ_ONLY")) return NextResponse.json({ error: "Dòng họ đang ở chế độ chỉ đọc." }, { status: 403 });
  if (error) return NextResponse.json({ error: "Không thể tạo phả đồ." }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
