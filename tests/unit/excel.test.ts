import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createExportWorkbook, parseImportWorkbook } from "@/lib/import-export/excel";
import { demoTree } from "@/lib/demo/data";

describe("Excel import/export", () => {
  it("exports two documented sheets and can preview the result", async () => {
    const workbook = await createExportWorkbook();
    expect(workbook.getWorksheet("ThanhVien")).toBeDefined();
    expect(workbook.getWorksheet("HuongDan")).toBeDefined();
    workbook.getWorksheet("ThanhVien")!.addRow(["TV0001", "", "Nguyễn Văn Gốc", "Nam", 1]);
    const output = await workbook.xlsx.writeBuffer();
    const preview = await parseImportWorkbook(Buffer.from(output), "create");
    expect(preview.stats.rows).toBe(1);
    expect(preview.stats.errors).toBe(0);
  });

  it("does not let create mode silently update exported person ids", async () => {
    const workbook = await createExportWorkbook(demoTree);
    const preview = await parseImportWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()), "create");
    expect(preview.stats.errors).toBe(demoTree.persons.length);
    expect(preview.issues.every((issue) => issue.code === "PERSON_ID_NOT_ALLOWED" || issue.severity === "warning")).toBe(true);
  });

  it("rejects missing references and cycles without partial acceptance", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("ThanhVien");
    sheet.addRow(["row_id", "ho_ten", "gioi_tinh", "doi", "row_id_cha"]);
    sheet.addRow(["A", "Nguyễn Văn A", "Nam", 1, "B"]);
    sheet.addRow(["B", "Nguyễn Văn B", "Nam", 2, "A"]);
    sheet.addRow(["C", "Nguyễn Văn C", "Nam", 3, "KHONG_TON_TAI"]);
    const preview = await parseImportWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
    expect(preview.stats.errors).toBeGreaterThanOrEqual(2);
    expect(preview.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["UNKNOWN_REFERENCE", "CYCLE"]));
  });

  it("previews the MVP maximum of 500 rows within the 30-second target", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("ThanhVien");
    sheet.addRow(["row_id", "ho_ten", "gioi_tinh", "doi", "row_id_cha"]);
    for (let index = 1; index <= 500; index += 1) {
      sheet.addRow([`TV${String(index).padStart(4, "0")}`, `Thành viên ${index}`, index % 2 ? "Nam" : "Nữ", Math.min(99, Math.ceil(index / 6)), index > 1 ? `TV${String(index - 1).padStart(4, "0")}` : ""]);
    }
    const input = Buffer.from(await workbook.xlsx.writeBuffer());
    const startedAt = performance.now();
    const preview = await parseImportWorkbook(input);
    expect(preview.stats).toMatchObject({ rows: 500, errors: 0 });
    expect(performance.now() - startedAt).toBeLessThan(30_000);
  }, 35_000);
});
