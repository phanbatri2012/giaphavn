import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPersonalEdition } from "@/lib/personal/mode";
import { updatePersonalProfile } from "@/lib/personal/site-store";

const schema = z.object({ fullName: z.string().trim().min(2).max(150) });
export async function PATCH(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Họ tên không hợp lệ." }, { status: 400 });
  if (isPersonalEdition() || !hasSupabaseConfig()) {
    await updatePersonalProfile(parsed.data.fullName);
    return NextResponse.json({ updated: true });
  }
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", auth.user.id);
  if (error) return NextResponse.json({ error: "Không thể cập nhật hồ sơ." }, { status: 400 });
  return NextResponse.json({ updated: true });
}
