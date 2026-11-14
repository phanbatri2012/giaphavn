import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const schema = z.object({ email: z.email().max(254) });

export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { tenantId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ invited: true, demo: true });
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if ((!resendKey || !from) && process.env.NODE_ENV === "production") return NextResponse.json({ error: "Dịch vụ email chưa được cấu hình." }, { status: 503 });
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_admin_invitation", { p_tenant_id: tenantId, p_email: parsed.data.email, p_token_hash: tokenHash, p_expires_at: expiresAt });
  if (error?.message.includes("ADMIN_LIMIT")) return NextResponse.json({ error: "Gói hiện tại đã hết chỗ quản trị viên." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Không thể tạo lời mời." }, { status: 403 });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_ROOT_URL ?? new URL(request.url).origin;
  const acceptUrl = `${appUrl}/loi-moi/${rawToken}`;
  if (resendKey && from) {
    const resend = new Resend(resendKey);
    const result = await resend.emails.send({ from, to: parsed.data.email, subject: "Lời mời quản trị không gian dòng họ", html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#3f2b22"><h1 style="color:#9d3e25">Bạn được mời cùng gìn giữ gia phả</h1><p>Chủ sở hữu đã mời bạn làm quản trị viên trên GiaPhaVN.</p><p><a href="${acceptUrl}" style="display:inline-block;padding:12px 18px;background:#a84328;color:white;text-decoration:none;border-radius:8px">Chấp nhận lời mời</a></p><p>Liên kết hết hạn sau 7 ngày và chỉ dùng được với đúng email nhận lời mời.</p></div>` });
    if (result.error) return NextResponse.json({ error: "Lời mời đã tạo nhưng email chưa gửi được. Hãy thử lại." }, { status: 502 });
  }
  return NextResponse.json({ invited: true, ...(process.env.NODE_ENV === "development" ? { acceptUrl } : {}) }, { status: 201 });
}
