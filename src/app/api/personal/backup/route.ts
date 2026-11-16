import { NextResponse } from "next/server";
import { demoStoreErrorResponse } from "@/lib/demo/response";
import {
  createPersonalBackup,
  isLocalDemoPersistenceEnabled,
  restorePersonalBackup
} from "@/lib/demo/store";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const maximumBackupBytes = 10 * 1024 * 1024;

function isAvailable(request: Request) {
  return localHosts.has(new URL(request.url).hostname) && isLocalDemoPersistenceEnabled();
}

export async function GET(request: Request) {
  if (!isAvailable(request)) return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  try {
    const backup = await createPersonalBackup();
    const date = backup.exportedAt.slice(0, 10);
    return new NextResponse(`${JSON.stringify(backup, null, 2)}\n`, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="giaphavn-backup-${date}.json"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    return demoStoreErrorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }
  if (!isAvailable(request)) return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maximumBackupBytes) {
    return NextResponse.json({ error: "File sao lưu vượt quá 10 MB." }, { status: 413 });
  }
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > maximumBackupBytes) {
      return NextResponse.json({ error: "File sao lưu vượt quá 10 MB." }, { status: 413 });
    }
    const tree = await restorePersonalBackup(JSON.parse(body));
    return NextResponse.json({ restored: true, graphVersion: tree.graphVersion });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "File sao lưu không phải JSON hợp lệ." }, { status: 400 });
    }
    return demoStoreErrorResponse(error);
  }
}
