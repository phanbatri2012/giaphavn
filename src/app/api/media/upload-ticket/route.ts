import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const schema = z.object({ tenantId: z.string().uuid(), filename: z.string().min(1).max(180), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]), size: z.number().int().positive().max(10 * 1024 * 1024) });

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tệp tải lên không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ demo: true, path: `${parsed.data.tenantId}/demo/${crypto.randomUUID()}` });
  const supabase = await createSupabaseServerClient();
  const [{ data: auth }, { data: usage }, { data: subscription }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("usage_counters").select("storage_bytes").eq("tenant_id", parsed.data.tenantId).maybeSingle(),
    supabase.from("subscriptions").select("status, plans(storage_limit_bytes)").eq("tenant_id", parsed.data.tenantId).maybeSingle()
  ]);
  if (!auth.user || !usage || !subscription || !["free", "active"].includes(subscription.status)) return NextResponse.json({ error: "Tenant đang ở chế độ chỉ đọc hoặc bạn không có quyền." }, { status: 403 });
  const plan = subscription.plans as unknown as { storage_limit_bytes: number } | null;
  if (!plan || Number(usage.storage_bytes) + parsed.data.size > Number(plan.storage_limit_bytes)) return NextResponse.json({ error: "Đã vượt hạn mức dung lượng." }, { status: 409 });
  const safeExtension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as const)[parsed.data.mimeType];
  const path = `${parsed.data.tenantId}/${auth.user.id}/${crypto.randomUUID()}.${safeExtension}`;
  const { data, error } = await supabase.storage.from("tenant-media").createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: "Không thể cấp quyền tải lên." }, { status: 500 });
  return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl });
}
