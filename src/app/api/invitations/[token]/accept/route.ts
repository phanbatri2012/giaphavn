import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { token } = await context.params;
  if (token.length < 20 || token.length > 100) return NextResponse.json({ error: "Lời mời không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ accepted: true, demo: true });
  const supabase = await createSupabaseServerClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabase.rpc("accept_admin_invitation", { p_token_hash: tokenHash });
  if (error?.message.includes("AUTH_REQUIRED")) return NextResponse.json({ error: "Vui lòng đăng nhập bằng email nhận lời mời." }, { status: 401 });
  if (error?.message.includes("EMAIL_MISMATCH")) return NextResponse.json({ error: "Email đăng nhập không trùng email được mời." }, { status: 403 });
  if (error) return NextResponse.json({ error: "Lời mời đã hết hạn, đã dùng hoặc không còn hợp lệ." }, { status: 400 });
  return NextResponse.json(data);
}
