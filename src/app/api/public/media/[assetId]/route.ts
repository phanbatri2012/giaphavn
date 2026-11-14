import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  if (!z.string().uuid().safeParse(assetId).success) {
    return NextResponse.json({ error: "Tài nguyên không hợp lệ." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Dịch vụ media chưa được cấu hình." }, { status: 503 });

  const { data: asset } = await admin
    .from("media_assets")
    .select("storage_path, is_public, tenants!inner(published, locked_at, deletion_requested_at)")
    .eq("id", assetId)
    .eq("is_public", true)
    .eq("tenants.published", true)
    .is("tenants.locked_at", null)
    .is("tenants.deletion_requested_at", null)
    .maybeSingle();
  if (!asset) return NextResponse.json({ error: "Không tìm thấy tài nguyên." }, { status: 404 });

  const { data, error } = await admin.storage.from("tenant-media").createSignedUrl(asset.storage_path, 300);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Không thể mở tài nguyên." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl, { status: 307, headers: { "Cache-Control": "private, no-store" } });
}
