import { NextResponse } from "next/server";
import { createPayOSClient } from "@/lib/payments/payos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientAddress, rateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 128 * 1024) return NextResponse.json({ error: "Payload quá lớn." }, { status: 413 });
  const limit = await rateLimit(`payos-webhook:${clientAddress(request.headers)}`, 120, 60_000);
  if (!limit.available) return NextResponse.json({ error: "Bộ bảo vệ webhook chưa sẵn sàng." }, { status: 503 });
  if (!limit.allowed) return NextResponse.json({ error: "Quá nhiều yêu cầu webhook." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const payos = createPayOSClient();
  const admin = createSupabaseAdminClient();
  if (!payos || !admin) return NextResponse.json({ error: "Webhook chưa được cấu hình." }, { status: 503 });
  try {
    const payload = await request.json();
    const data = await payos.webhooks.verify(payload);
    if (data.code !== "00") return NextResponse.json({ success: true, ignored: true });
    const { error } = await admin.rpc("apply_successful_payment", {
      p_order_code: data.orderCode,
      p_reference: data.reference,
      p_amount: data.amount,
      p_payload: {
        code: data.code,
        description: data.description,
        transactionDateTime: data.transactionDateTime,
        reference: data.reference
      }
    });
    if (error?.message.includes("ORDER_NOT_FOUND")) return NextResponse.json({ success: true, ignored: true, reason: "unknown_order" });
    if (error) return NextResponse.json({ error: "Không thể đối soát giao dịch." }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Chữ ký webhook không hợp lệ." }, { status: 400 });
  }
}
