import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function mutate(request: Request, context: { params: Promise<{ tenantId: string }> }, action: "request" | "cancel") {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { tenantId } = await context.params;
  if (!z.string().uuid().safeParse(tenantId).success && tenantId !== "tenant-demo-hong-viet") {
    return NextResponse.json({ error: "Dòng họ không hợp lệ." }, { status: 400 });
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json(action === "request"
      ? { requested: true, purgeAfter: new Date(Date.now() + 30 * 86400_000).toISOString(), demo: true }
      : { cancelled: true, demo: true });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(action === "request" ? "request_tenant_deletion" : "cancel_tenant_deletion", { p_tenant_id: tenantId });
  if (error?.message.includes("PURGE_STARTED")) return NextResponse.json({ error: "Quá trình xóa dữ liệu đã bắt đầu." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Không thể cập nhật yêu cầu xóa dữ liệu." }, { status: 403 });
  return NextResponse.json(data);
}

export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  return mutate(request, context, "request");
}

export async function DELETE(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  return mutate(request, context, "cancel");
}
