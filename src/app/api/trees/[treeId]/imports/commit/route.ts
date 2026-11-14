import { NextResponse } from "next/server";
import { z } from "zod";
import { demoTree } from "@/lib/demo/data";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

const schema = z.object({ jobId: z.string().min(8), acceptWarnings: z.boolean().default(false) });

export async function POST(request: Request, context: { params: Promise<{ treeId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { treeId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Yêu cầu xác nhận không hợp lệ." }, { status: 400 });
  if (!hasSupabaseConfig()) {
    if (treeId !== demoTree.id || !parsed.data.jobId.startsWith("demo-")) return NextResponse.json({ error: "Không tìm thấy bản xem trước." }, { status: 404 });
    return NextResponse.json({ committed: true, demo: true, graphVersion: demoTree.graphVersion + 1 });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("commit_import_job", { p_job_id: parsed.data.jobId, p_accept_warnings: parsed.data.acceptWarnings });
  if (error?.message.includes("VERSION_CONFLICT")) return NextResponse.json({ error: "Phả đồ đã thay đổi. Hãy tải lại file.", code: "VERSION_CONFLICT" }, { status: 409 });
  if (error?.message.includes("WARNINGS_NOT_ACCEPTED")) return NextResponse.json({ error: "Bạn cần xác nhận các cảnh báo trước khi import." }, { status: 400 });
  if (error) return NextResponse.json({ error: "Không thể ghi dữ liệu import." }, { status: 400 });
  return NextResponse.json(data);
}
