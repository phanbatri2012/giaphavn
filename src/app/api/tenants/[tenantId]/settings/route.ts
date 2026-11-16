import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPersonalEdition } from "@/lib/personal/mode";
import { updatePersonalBranding } from "@/lib/personal/site-store";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const schema = z.object({ name: z.string().trim().min(2).max(160), shortName: z.string().trim().min(2).max(100), introduction: z.string().trim().max(1000), chronicle: z.string().trim().max(20000), address: z.string().trim().max(500), contactEmail: z.union([z.literal(""), z.string().email().max(180)]), contactPhone: z.string().trim().max(30), mapUrl: z.union([z.literal(""), z.string().url().max(1000)]), primaryColor: color, accentColor: color, logoUrl: z.string().max(1000), bannerUrl: z.string().max(1000), published: z.boolean(), seoTitle: z.string().trim().max(160), seoDescription: z.string().trim().max(320) });

export async function PATCH(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { tenantId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin website không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
  if (isPersonalEdition() || !hasSupabaseConfig()) {
    try {
      const branding = await updatePersonalBranding(tenantId, parsed.data);
      return NextResponse.json({ updated: true, branding });
    } catch {
      return NextResponse.json({ error: "Không thể lưu thông tin website local." }, { status: 400 });
    }
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_tenant_branding", { p_tenant_id: tenantId, p_payload: { ...parsed.data, seo: { title: parsed.data.seoTitle, description: parsed.data.seoDescription } } });
  if (error?.message.includes("PUBLISH_REQUIREMENTS")) return NextResponse.json({ error: "Hãy hoàn thành lời giới thiệu và phả đồ trước khi xuất bản." }, { status: 409 });
  if (error?.message.includes("TENANT_READ_ONLY")) return NextResponse.json({ error: "Dòng họ đang ở chế độ chỉ đọc." }, { status: 403 });
  if (error) return NextResponse.json({ error: "Không thể lưu thông tin website." }, { status: 400 });
  return NextResponse.json(data);
}
