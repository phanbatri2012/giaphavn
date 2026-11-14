import { NextResponse } from "next/server";
import { createExportWorkbook } from "@/lib/import-export/excel";
import { getEditableTree } from "@/lib/repository/trees";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await context.params;
  if (!await getEditableTree(treeId)) return NextResponse.json({ error: "Không tìm thấy phả đồ hoặc bạn không có quyền." }, { status: 404 });
  const workbook = await createExportWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=gia-pha-mau.xlsx",
      "Cache-Control": "private, no-store"
    }
  });
}
