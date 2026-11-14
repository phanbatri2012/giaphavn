import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyTreeAccessCode } from "@/lib/security/access-code";
import { clientAddress, rateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const bodySchema = z.object({ code: z.string().min(4).max(100), turnstileToken: z.string().optional() });

export async function POST(request: Request, context: { params: Promise<{ treeId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { treeId } = await context.params;
  const ip = clientAddress(request.headers);
  const limit = await rateLimit(`tree-unlock:${treeId}:${ip}`, 8, 15 * 60_000);
  if (!limit.available) return NextResponse.json({ error: "Bộ bảo vệ mã truy cập chưa sẵn sàng." }, { status: 503 });
  if (!limit.allowed) return NextResponse.json({ error: "Thử quá nhiều lần." }, { status: 429 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mã không hợp lệ." }, { status: 400 });
  if (limit.remaining < 5 && !(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
    return NextResponse.json({ error: "Vui lòng hoàn thành bước xác minh trước khi thử lại.", captchaRequired: true }, { status: 403 });
  }

  let hashValue = process.env.TREE_ACCESS_HASH;
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data } = await admin
      .from("family_trees")
      .select("access_code_hash, visibility, archived_at, tenants!inner(published, locked_at, deletion_requested_at)")
      .eq("id", treeId)
      .eq("visibility", "protected")
      .is("archived_at", null)
      .eq("tenants.published", true)
      .is("tenants.locked_at", null)
      .is("tenants.deletion_requested_at", null)
      .maybeSingle();
    hashValue = data?.access_code_hash ?? undefined;
  }
  if (!hashValue || !(await verifyTreeAccessCode(hashValue, parsed.data.code))) {
    return NextResponse.json({ error: "Mã bảo mật không đúng." }, { status: 401 });
  }

  const secret = process.env.TREE_ACCESS_COOKIE_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Hệ thống chưa cấu hình khóa phiên." }, { status: 503 });
  const expires = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const value = `${expires}.${createHmac("sha256", secret).update(`${treeId}.${expires}`).digest("hex")}`;
  const response = NextResponse.json({ unlocked: true, expiresAt: new Date(expires * 1000).toISOString() });
  response.cookies.set(`tree_access_${treeId}`, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 12 * 60 * 60,
    path: `/`
  });
  return response;
}
