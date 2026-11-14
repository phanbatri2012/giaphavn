import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const schema = z.object({ tenantId: z.string().uuid(), path: z.string().min(20).max(500), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]), size: z.number().int().positive().max(10 * 1024 * 1024), width: z.number().int().positive().max(20000).optional(), height: z.number().int().positive().max(20000).optional(), albumId: z.string().uuid().optional(), isPublic: z.boolean().default(false) });

function matchesSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  const text = new TextDecoder("ascii").decode(bytes.slice(0, 12));
  if (mime === "image/webp") return text.startsWith("RIFF") && text.slice(8, 12) === "WEBP";
  if (mime === "image/gif") return text.startsWith("GIF87a") || text.startsWith("GIF89a");
  return false;
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.path.startsWith(`${parsed.data.tenantId}/`)) return NextResponse.json({ error: "Thông tin tệp không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ id: crypto.randomUUID(), demo: true });
  const supabase = await createSupabaseServerClient();
  const { data: file, error: downloadError } = await supabase.storage.from("tenant-media").download(parsed.data.path);
  if (downloadError || !file || file.size !== parsed.data.size) return NextResponse.json({ error: "Không tìm thấy tệp hoặc kích thước không khớp." }, { status: 400 });
  const head = new Uint8Array((await file.slice(0, 16).arrayBuffer()));
  if (!matchesSignature(head, parsed.data.mimeType)) {
    await supabase.storage.from("tenant-media").remove([parsed.data.path]);
    return NextResponse.json({ error: "Nội dung tệp không khớp MIME đã khai báo; tệp đã bị loại bỏ." }, { status: 415 });
  }
  const { data, error } = await supabase.rpc("finalize_media_asset", { p_tenant_id: parsed.data.tenantId, p_storage_path: parsed.data.path, p_mime_type: parsed.data.mimeType, p_size_bytes: parsed.data.size, p_width: parsed.data.width ?? null, p_height: parsed.data.height ?? null });
  if (error) {
    await supabase.storage.from("tenant-media").remove([parsed.data.path]);
    return NextResponse.json({ error: error.message.includes("STORAGE_LIMIT") ? "Đã vượt hạn mức dung lượng." : "Không thể hoàn tất tải lên." }, { status: error.message.includes("STORAGE_LIMIT") ? 409 : 400 });
  }
  if (parsed.data.isPublic) {
    const { error: visibilityError } = await supabase.rpc("set_media_asset_visibility", { p_asset_id: data, p_is_public: true });
    if (visibilityError) return NextResponse.json({ error: "Tệp đã tải lên nhưng chưa thể công khai." }, { status: 400 });
  }
  if (parsed.data.albumId) {
    const { error: albumError } = await supabase.rpc("attach_media_to_album", { p_asset_id: data, p_album_id: parsed.data.albumId });
    if (albumError) return NextResponse.json({ error: "Tệp đã tải lên nhưng chưa thể gắn vào album." }, { status: 400 });
  }
  return NextResponse.json({ id: data, path: parsed.data.path, publicUrl: parsed.data.isPublic ? `/api/public/media/${data}` : undefined }, { status: 201 });
}
