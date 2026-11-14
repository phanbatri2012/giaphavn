import { NextResponse } from "next/server";
import { z } from "zod";
import { PLANS } from "@/lib/domain/plans";
import { createPayOSClient } from "@/lib/payments/payos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const paymentSchema = z.object({
  tenantId: z.string().min(3).max(100),
  planId: z.enum(["basic", "community"]),
  kind: z.enum(["purchase", "renew", "upgrade"])
});

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = paymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Yêu cầu thanh toán không hợp lệ." }, { status: 400 });
  const demoPlan = PLANS.find((item) => item.id === parsed.data.planId);
  if (!demoPlan || demoPlan.annualPrice <= 0) return NextResponse.json({ error: "Gói không thể thanh toán." }, { status: 400 });
  const payos = createPayOSClient();
  if (!hasSupabaseConfig()) return NextResponse.json({ demo: true, orderCode: Date.now() % 2_000_000_000, amount: demoPlan.annualPrice });
  if (process.env.PAYMENTS_ENABLED !== "true") return NextResponse.json({ error: "Thanh toán đang tạm đóng trong giai đoạn pilot." }, { status: 503 });
  if (!payos) return NextResponse.json({ error: "PayOS chưa được cấu hình." }, { status: 503 });

  const supabase = await createSupabaseServerClient();
  const [{ data: auth }, { data: membership }, { data: storedPlan }, { data: currentSubscription }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("memberships").select("role").eq("tenant_id", parsed.data.tenantId).maybeSingle(),
    supabase.from("plans").select("id, name, annual_price").eq("id", parsed.data.planId).eq("active", true).maybeSingle(),
    supabase.from("subscriptions").select("plan_id, status").eq("tenant_id", parsed.data.tenantId).maybeSingle()
  ]);
  if (!auth.user || !membership) return NextResponse.json({ error: "Bạn không có quyền thanh toán cho dòng họ này." }, { status: 403 });
  if (!storedPlan || Number(storedPlan.annual_price) <= 0) return NextResponse.json({ error: "Gói không thể thanh toán." }, { status: 400 });
  const kind = currentSubscription?.plan_id === storedPlan.id ? "renew" : currentSubscription?.plan_id === "free" ? "purchase" : "upgrade";
  const amount = Number(storedPlan.annual_price);

  const orderCode = Math.floor((Date.now() + crypto.getRandomValues(new Uint32Array(1))[0]) % 2_000_000_000);
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
  const rootUrl = process.env.NEXT_PUBLIC_ROOT_URL ?? new URL(request.url).origin;
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Kho lưu trữ thanh toán chưa được cấu hình." }, { status: 503 });
  const { error: insertError } = await admin.from("payment_orders").insert({
    tenant_id: parsed.data.tenantId,
    plan_id: storedPlan.id,
    kind,
    amount,
    status: "pending",
    payos_order_code: orderCode,
    expires_at: new Date(expiresAt * 1000).toISOString()
  });
  if (insertError) return NextResponse.json({ error: "Không thể tạo đơn thanh toán." }, { status: 500 });

  try {
    const payment = await payos.paymentRequests.create({
      orderCode,
      amount,
      description: `GIAPHAVN ${orderCode}`.slice(0, 25),
      returnUrl: `${rootUrl}/app/goi-dich-vu?payment=success&order=${orderCode}`,
      cancelUrl: `${rootUrl}/app/goi-dich-vu?payment=cancelled&order=${orderCode}`,
      items: [{ name: `Gói ${storedPlan.name} 365 ngày`, quantity: 1, price: amount }],
      expiredAt: expiresAt
    });
    await admin.from("payment_orders").update({ payos_payment_link_id: payment.paymentLinkId }).eq("payos_order_code", orderCode);
    return NextResponse.json({ checkoutUrl: payment.checkoutUrl, orderCode, amount });
  } catch {
    await admin.from("payment_orders").update({ status: "failed" }).eq("payos_order_code", orderCode);
    return NextResponse.json({ error: "PayOS chưa thể tạo liên kết thanh toán." }, { status: 502 });
  }
}
