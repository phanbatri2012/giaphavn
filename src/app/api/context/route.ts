import { NextResponse } from "next/server";
import { z } from "zod";
import { TENANT_CONTEXT_COOKIE, TREE_CONTEXT_COOKIE } from "@/lib/repository/current-tenant";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ tenantId: z.string().min(3).max(100), treeId: z.string().min(3).max(100).optional() });

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Không gian quản trị không hợp lệ." }, { status: 400 });

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data: membership } = await supabase.from("memberships").select("tenant_id").eq("tenant_id", parsed.data.tenantId).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Bạn không có quyền với dòng họ này." }, { status: 403 });
    if (parsed.data.treeId) {
      const { data: tree } = await supabase.from("family_trees").select("id").eq("id", parsed.data.treeId).eq("tenant_id", parsed.data.tenantId).is("archived_at", null).maybeSingle();
      if (!tree) return NextResponse.json({ error: "Phả đồ không thuộc dòng họ đã chọn." }, { status: 403 });
    }
  }

  const response = NextResponse.json({ selected: true });
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 365 * 86400 };
  response.cookies.set(TENANT_CONTEXT_COOKIE, parsed.data.tenantId, options);
  if (parsed.data.treeId) response.cookies.set(TREE_CONTEXT_COOKIE, parsed.data.treeId, options);
  else response.cookies.set(TREE_CONTEXT_COOKIE, "", { ...options, maxAge: 0 });
  return response;
}
