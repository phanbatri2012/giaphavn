import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPersonalEdition } from "@/lib/personal/mode";
import { updatePersonalContact } from "@/lib/personal/site-store";

const schema = z.object({ status: z.enum(["unread", "read", "resolved"]) });

export async function PATCH(request: Request, context: { params: Promise<{ tenantId: string; messageId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { tenantId, messageId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
  if (isPersonalEdition() || !hasSupabaseConfig()) {
    try {
      await updatePersonalContact(tenantId, messageId, parsed.data.status);
      return NextResponse.json({ updated: true });
    } catch {
      return NextResponse.json({ error: "Không tìm thấy lời nhắn." }, { status: 404 });
    }
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("contact_messages").update({ status: parsed.data.status }).eq("id", messageId).eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: "Không thể cập nhật lời nhắn." }, { status: 400 });
  return NextResponse.json({ updated: true });
}
