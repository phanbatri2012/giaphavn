import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getPersonalMedia, removePersonalMedia } from "@/lib/personal/site-store";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
type Context = { params: Promise<{ assetId: string }> };

export async function GET(request: Request, context: Context) {
  if (!localHosts.has(new URL(request.url).hostname)) return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  const { assetId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return NextResponse.json({ error: "Ảnh không hợp lệ." }, { status: 400 });
  const media = await getPersonalMedia(assetId);
  if (!media) return NextResponse.json({ error: "Không tìm thấy ảnh." }, { status: 404 });
  try {
    const bytes = await readFile(path.join(process.cwd(), ".data", "media", media.filename));
    return new NextResponse(bytes, {
      headers: {
        "content-type": media.mimeType,
        "content-length": String(bytes.byteLength),
        "cache-control": media.isPublic ? "public, max-age=3600" : "private, no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Tệp ảnh không còn trên ổ đĩa." }, { status: 404 });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (!localHosts.has(new URL(request.url).hostname)) return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  const { assetId } = await context.params;
  try {
    const media = await removePersonalMedia(assetId);
    await unlink(path.join(process.cwd(), ".data", "media", media.filename)).catch(() => undefined);
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Không tìm thấy ảnh." }, { status: 404 });
  }
}
