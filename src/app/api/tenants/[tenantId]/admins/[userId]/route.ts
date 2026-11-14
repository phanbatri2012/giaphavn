import { NextResponse } from "next/server";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(request: Request, context: { params: Promise<{ tenantId: string; userId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { tenantId, userId } = await context.params;
  if (!hasSupabaseConfig()) return NextResponse.json({ removed: true, demo: true });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_tenant_admin", { p_tenant_id: tenantId, p_user_id: userId });
  if (error?.message.includes("OWNER_CANNOT_BE_REMOVED")) return NextResponse.json({ error: "Không thể xóa chủ sở hữu." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Không thể xóa quản trị viên." }, { status: 403 });
  return NextResponse.json({ removed: true });
}
