import { NextResponse } from "next/server";
import { z } from "zod";
import { clientAddress, rateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const contactSchema = z.object({
  tenantId: z.string().min(3).max(100),
  name: z.string().trim().min(2).max(100),
  contact: z.string().trim().min(5).max(120),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(0).optional().default(""),
  turnstileToken: z.string().optional()
});

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const ip = clientAddress(request.headers);
  const limit = await rateLimit(`contact:${ip}`, 5, 15 * 60_000);
  if (!limit.available) return NextResponse.json({ error: "Bộ bảo vệ chống spam chưa sẵn sàng." }, { status: 503 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Bạn đã gửi quá nhiều lời nhắn." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }
  const parsed = contactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dữ liệu lời nhắn chưa hợp lệ." }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ accepted: true }, { status: 202 });
  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
    return NextResponse.json({ error: "Không thể xác minh yêu cầu." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ accepted: true, demo: true }, { status: 202 });
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("id", parsed.data.tenantId)
    .eq("published", true)
    .is("locked_at", null)
    .is("deletion_requested_at", null)
    .maybeSingle();
  if (!tenant) return NextResponse.json({ error: "Website dòng họ không còn nhận lời nhắn." }, { status: 404 });
  const { error } = await admin.from("contact_messages").insert({
    tenant_id: parsed.data.tenantId,
    name: parsed.data.name,
    email: parsed.data.contact.includes("@") ? parsed.data.contact : null,
    phone: parsed.data.contact.includes("@") ? null : parsed.data.contact,
    message: parsed.data.message,
    status: "unread"
  });
  if (error) return NextResponse.json({ error: "Chưa thể lưu lời nhắn." }, { status: 500 });
  return NextResponse.json({ accepted: true }, { status: 201 });
}
