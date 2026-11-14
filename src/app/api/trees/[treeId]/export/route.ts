import { NextResponse } from "next/server";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { createExportWorkbook } from "@/lib/import-export/excel";
import { renderTreeSvg } from "@/lib/import-export/render-tree";
import { getEditableTree } from "@/lib/repository/trees";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await context.params;
  const tree = await getEditableTree(treeId);
  if (!tree) return NextResponse.json({ error: "Không tìm thấy phả đồ hoặc bạn không có quyền." }, { status: 404 });
  const format = new URL(request.url).searchParams.get("format") ?? "xlsx";
  const filename = `gia-pha-${treeId}`;
  if (format === "xlsx") {
    const workbook = await createExportWorkbook(tree);
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}.xlsx"` } });
  }
  const svg = renderTreeSvg(tree);
  if (format === "svg") return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.svg"` } });
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  if (format === "png") return new NextResponse(png, { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${filename}.png"` } });
  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([842, 595]);
    const scale = Math.min(782 / image.width, 535 / image.height);
    page.drawImage(image, { x: (842 - image.width * scale) / 2, y: (595 - image.height * scale) / 2, width: image.width * scale, height: image.height * scale });
    return new NextResponse(Buffer.from(await pdf.save()), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"` } });
  }
  return NextResponse.json({ error: "Định dạng không được hỗ trợ." }, { status: 400 });
}

