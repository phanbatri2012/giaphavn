import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { addPersonalMedia, type PersonalMedia } from "@/lib/personal/site-store";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const mimeExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
} as const;

function matchesSignature(bytes: Uint8Array, mime: keyof typeof mimeExtensions) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  const text = new TextDecoder("ascii").decode(bytes.slice(0, 12));
  if (mime === "image/webp") return text.startsWith("RIFF") && text.slice(8, 12) === "WEBP";
  return text.startsWith("GIF87a") || text.startsWith("GIF89a");
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (!localHosts.has(new URL(request.url).hostname)) return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const tenantId = String(form?.get("tenantId") ?? "");
  const albumId = String(form?.get("albumId") ?? "") || undefined;
  const alt = String(form?.get("alt") ?? "").slice(0, 300);
  const isPublic = form?.get("isPublic") === "true";
  if (!(file instanceof File) || !tenantId || file.size < 1 || file.size > 10 * 1024 * 1024 || !(file.type in mimeExtensions)) {
    return NextResponse.json({ error: "Tệp ảnh không hợp lệ hoặc vượt quá 10 MB." }, { status: 400 });
  }
  const mimeType = file.type as keyof typeof mimeExtensions;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(bytes, mimeType)) {
    return NextResponse.json({ error: "Nội dung tệp không khớp định dạng ảnh đã khai báo." }, { status: 415 });
  }

  const id = crypto.randomUUID();
  const filename = `${id}.${mimeExtensions[mimeType]}`;
  const directory = path.join(process.cwd(), ".data", "media");
  const destination = path.join(directory, filename);
  await mkdir(directory, { recursive: true });
  await writeFile(destination, bytes, { flag: "wx" });
  const media: PersonalMedia = {
    id,
    filename,
    mimeType,
    size: file.size,
    originalName: file.name.slice(0, 180),
    isPublic,
    albumId
  };
  try {
    await addPersonalMedia(tenantId, media, { albumId, alt });
  } catch {
    await unlink(destination).catch(() => undefined);
    return NextResponse.json({ error: "Không thể gắn ảnh vào gia phả hoặc album." }, { status: 400 });
  }
  return NextResponse.json({ id, publicUrl: `/api/personal/media/${id}` }, { status: 201 });
}
