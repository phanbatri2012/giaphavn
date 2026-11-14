import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  if (!z.string().uuid().safeParse(assetId).success) return NextResponse.json({ error: "Ảnh không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Ảnh demo không có tệp gốc." }, { status: 404 });
  const supabase = await createSupabaseServerClient();
  const { data: asset } = await supabase.from("media_assets").select("storage_path").eq("id", assetId).maybeSingle();
  if (!asset) return NextResponse.json({ error: "Không tìm thấy ảnh hoặc bạn không có quyền." }, { status: 404 });
  const { data, error } = await supabase.storage.from("tenant-media").createSignedUrl(asset.storage_path, 10 * 60);
  if (error || !data) return NextResponse.json({ error: "Không thể mở ảnh." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request, context: { params: Promise<{ assetId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { assetId } = await context.params;
  if (!z.string().uuid().safeParse(assetId).success && !assetId.startsWith("demo-")) return NextResponse.json({ error: "Ảnh không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ deleted: true, demo: true });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("delete_media_asset", { p_asset_id: assetId });
  if (error) return NextResponse.json({ error: error.message.includes("TENANT_READ_ONLY") ? "Dòng họ đang ở chế độ chỉ đọc." : "Không thể xóa ảnh." }, { status: error.message.includes("TENANT_READ_ONLY") ? 403 : 400 });
  const storagePath = (data as { storagePath?: string } | null)?.storagePath;
  if (storagePath) {
    const storageClient = createSupabaseAdminClient() ?? supabase;
    const { error: storageError } = await storageClient.storage.from("tenant-media").remove([storagePath]);
    if (storageError) return NextResponse.json({ deleted: true, warning: "Metadata đã xóa nhưng Storage cần được dọn bởi tác vụ bảo trì." });
  }
  return NextResponse.json({ deleted: true });
}
