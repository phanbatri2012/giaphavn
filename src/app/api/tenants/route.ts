import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeVietnameseName } from "@/lib/domain/genealogy";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const RESERVED = new Set(["app", "www", "api", "admin", "ops", "support", "mail", "static", "assets", "auth", "demo"]);
const schema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/),
  rootPersonName: z.string().trim().min(2).max(150),
  rootPersonGender: z.enum(["male", "female", "other"]).default("male")
});

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || RESERVED.has(parsed.data?.slug ?? "")) return NextResponse.json({ error: "Thông tin dòng họ hoặc slug không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ tenantId: crypto.randomUUID(), treeId: crypto.randomUUID(), demo: true }, { status: 201 });
  if (process.env.PUBLIC_REGISTRATION_ENABLED !== "true") return NextResponse.json({ error: "Đăng ký dòng họ đang tạm đóng trong giai đoạn pilot." }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  if (!auth.user.email_confirmed_at) return NextResponse.json({ error: "Hãy xác minh email trước khi tạo dòng họ." }, { status: 403 });
  const { data, error } = await supabase.rpc("create_tenant_with_root", {
    p_name: parsed.data.name, p_slug: parsed.data.slug, p_root_name: parsed.data.rootPersonName,
    p_root_search_name: normalizeVietnameseName(parsed.data.rootPersonName), p_root_gender: parsed.data.rootPersonGender
  });
  if (error?.code === "23505") return NextResponse.json({ error: "Slug đã được sử dụng." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Không thể tạo dòng họ." }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
