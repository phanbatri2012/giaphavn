import { NextResponse } from "next/server";
import { demoStoreErrorResponse } from "@/lib/demo/response";
import { isLocalDemoPersistenceEnabled, resetDemoData } from "@/lib/demo/store";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }
  if (!localHosts.has(new URL(request.url).hostname) || !isLocalDemoPersistenceEnabled()) {
    return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  }
  try {
    const tree = await resetDemoData();
    return NextResponse.json({ reset: true, graphVersion: tree.graphVersion });
  } catch (error) {
    return demoStoreErrorResponse(error);
  }
}
