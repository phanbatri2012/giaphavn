import { NextResponse } from "next/server";
import { parseImportWorkbook } from "@/lib/import-export/excel";
import { demoTree } from "@/lib/demo/data";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ treeId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { treeId } = await context.params;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const mode = form?.get("mode") === "update" ? "update" : "create";
  if (!(file instanceof File)) return NextResponse.json({ error: "Vui lòng chọn file Excel." }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "File Excel tối đa 2 MB." }, { status: 413 });
  if (!file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "Chỉ chấp nhận file .xlsx." }, { status: 415 });
  const preview = await parseImportWorkbook(Buffer.from(await file.arrayBuffer()), mode).catch(() => null);
  if (!preview) return NextResponse.json({ error: "Không thể đọc file Excel." }, { status: 400 });
  if (!hasSupabaseConfig()) {
    if (treeId !== demoTree.id) return NextResponse.json({ error: "Không tìm thấy phả đồ." }, { status: 404 });
    return NextResponse.json({ jobId: preview.stats.errors ? null : `demo-${crypto.randomUUID()}`, canCommit: preview.stats.errors === 0, ...preview });
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: auth }, { data: tree }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("family_trees").select("tenant_id, graph_version").eq("id", treeId).maybeSingle()
  ]);
  if (!auth.user || !tree) return NextResponse.json({ error: "Bạn không có quyền với phả đồ này." }, { status: 403 });
  const [{ data: existingPeople }, { data: subscription }] = await Promise.all([
    supabase.from("persons").select("id, search_name").eq("tree_id", treeId).is("archived_at", null),
    supabase.from("subscriptions").select("plans(member_limit)").eq("tenant_id", tree.tenant_id).maybeSingle()
  ]);
  const activePeople = existingPeople ?? [];
  const importedIds = new Set(preview.rows.map((row) => row.personId).filter(Boolean));
  if (mode === "update") {
    const activeIds = new Set(activePeople.map((person) => person.id));
    preview.rows.forEach((row, index) => {
      if (row.personId && !activeIds.has(row.personId)) preview.issues.push({ row: index + 2, field: "person_id", code: "PERSON_NOT_IN_TREE", message: "person_id không thuộc phả đồ đang cập nhật.", severity: "error" });
    });
    const missing = activePeople.filter((person) => !importedIds.has(person.id));
    if (missing.length) preview.issues.push({ row: 0, field: "person_id", code: "INCOMPLETE_UPDATE_EXPORT", message: `File cập nhật thiếu ${missing.length} thành viên đang hoạt động. Hãy xuất lại danh sách mới nhất rồi chỉnh sửa trên file đó.`, severity: "error" });
  } else {
    const existingNames = new Set(activePeople.map((person) => person.search_name));
    preview.rows.forEach((row, index) => {
      if (existingNames.has(row.searchName)) preview.issues.push({ row: index + 2, field: "ho_ten", code: "POSSIBLE_EXISTING_DUPLICATE", message: "Phả đồ đã có thành viên cùng tên; hãy kiểm tra trước khi xác nhận.", severity: "warning" });
    });
  }
  const plan = subscription?.plans as unknown as { member_limit: number } | null;
  if (plan && activePeople.length + preview.stats.newPersons > Number(plan.member_limit)) preview.issues.push({ row: 0, code: "MEMBER_LIMIT", message: `Import sẽ vượt hạn mức ${plan.member_limit} thành viên của gói hiện tại.`, severity: "error" });
  preview.stats.errors = preview.issues.filter((issue) => issue.severity === "error").length;
  preview.stats.warnings = preview.issues.filter((issue) => issue.severity === "warning").length;
  if (preview.stats.errors > 0) return NextResponse.json({ jobId: null, canCommit: false, ...preview });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Dịch vụ import chưa được cấu hình." }, { status: 503 });
  const { data: job, error } = await admin.from("import_jobs").insert({
    tenant_id: tree.tenant_id, tree_id: treeId, created_by: auth.user.id, mode, status: "ready",
    row_count: preview.stats.rows, warning_count: preview.stats.warnings,
    preview_payload: { expectedVersion: Number(tree.graph_version), rows: preview.rows },
    expires_at: new Date(Date.now() + 60 * 60_000).toISOString()
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Không thể lưu bản xem trước." }, { status: 500 });
  return NextResponse.json({ jobId: job.id, canCommit: true, ...preview });
}
