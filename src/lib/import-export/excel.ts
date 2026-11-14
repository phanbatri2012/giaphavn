import ExcelJS from "exceljs";
import { normalizeVietnameseName } from "@/lib/domain/genealogy";
import type { FamilyTree, PersonGender, RelationshipType } from "@/lib/domain/types";

const COLUMNS = [
  "row_id",
  "person_id",
  "ho_ten",
  "gioi_tinh",
  "doi",
  "ten_thuong_goi",
  "vai_ve",
  "ngay_sinh",
  "do_chinh_xac_ngay_sinh",
  "loai_lich_ngay_sinh",
  "da_mat",
  "row_id_cha",
  "row_id_me",
  "row_id_vo_chong",
  "loai_quan_he"
] as const;

export type ImportIssue = {
  row: number;
  field?: string;
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type ImportPersonRow = {
  rowId: string;
  personId?: string;
  fullName: string;
  searchName: string;
  gender: PersonGender;
  generation: number;
  otherName?: string;
  roleTitle?: string;
  birthValue?: string;
  birthPrecision?: "year" | "month" | "day";
  birthCalendar?: "solar" | "lunar";
  isDeceased: boolean;
  fatherRowId?: string;
  motherRowId?: string;
  spouseRowIds: string[];
  relationshipType: RelationshipType;
};

export type ImportPreview = {
  rows: ImportPersonRow[];
  issues: ImportIssue[];
  stats: { rows: number; errors: number; warnings: number; newPersons: number; updates: number };
};

function textValue(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return cell.text.trim();
}

function parseBoolean(value: string) {
  return ["1", "true", "co", "có", "yes", "x"].includes(value.trim().toLocaleLowerCase("vi"));
}

function parseGender(value: string): PersonGender | undefined {
  const normalized = normalizeVietnameseName(value);
  if (["nam", "male", "m"].includes(normalized)) return "male";
  if (["nu", "female", "f"].includes(normalized)) return "female";
  if (["khac", "other", "o"].includes(normalized)) return "other";
}

function validPartialDate(value: string, precision: string) {
  if (precision === "year") return /^\d{4}$/.test(value);
  if (precision === "month") return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  if (precision === "day" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  return false;
}

function detectRowCycle(rows: ImportPersonRow[]) {
  const graph = new Map(rows.map((row) => [row.rowId, [row.fatherRowId, row.motherRowId].filter(Boolean) as string[]]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycle: string[] | undefined;
  const visit = (id: string, path: string[]) => {
    if (visiting.has(id)) {
      cycle = [...path.slice(path.indexOf(id)), id];
      return true;
    }
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const parent of graph.get(id) ?? []) if (visit(parent, [...path, parent])) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const id of graph.keys()) if (visit(id, [id])) break;
  return cycle;
}

export async function parseImportWorkbook(input: Buffer, mode: "create" | "update" = "create"): Promise<ImportPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet("ThanhVien");
  const issues: ImportIssue[] = [];
  if (!sheet) {
    issues.push({ row: 0, code: "MISSING_SHEET", message: "Không tìm thấy sheet ThanhVien.", severity: "error" });
    return { rows: [], issues, stats: { rows: 0, errors: 1, warnings: 0, newPersons: 0, updates: 0 } };
  }

  const header = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => header.set(textValue(cell).toLocaleLowerCase("vi"), col));
  for (const required of ["row_id", "ho_ten", "gioi_tinh", "doi"]) {
    if (!header.has(required)) issues.push({ row: 1, field: required, code: "MISSING_COLUMN", message: `Thiếu cột bắt buộc ${required}.`, severity: "error" });
  }
  if (issues.some((issue) => issue.severity === "error")) {
    return { rows: [], issues, stats: { rows: 0, errors: issues.length, warnings: 0, newPersons: 0, updates: 0 } };
  }

  const value = (row: ExcelJS.Row, key: string) => {
    const column = header.get(key);
    return column ? textValue(row.getCell(column)) : "";
  };
  const rows: ImportPersonRow[] = [];
  const seen = new Set<string>();
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (!row.hasValues) continue;
    const rowId = value(row, "row_id");
    const fullName = value(row, "ho_ten");
    const gender = parseGender(value(row, "gioi_tinh"));
    const generation = Number(value(row, "doi"));
    if (!rowId) issues.push({ row: rowNumber, field: "row_id", code: "REQUIRED", message: "row_id là bắt buộc.", severity: "error" });
    if (rowId && seen.has(rowId)) issues.push({ row: rowNumber, field: "row_id", code: "DUPLICATE_ROW_ID", message: `row_id ${rowId} bị trùng.`, severity: "error" });
    if (!fullName) issues.push({ row: rowNumber, field: "ho_ten", code: "REQUIRED", message: "Họ tên là bắt buộc.", severity: "error" });
    if (!gender) issues.push({ row: rowNumber, field: "gioi_tinh", code: "INVALID_GENDER", message: "Giới tính phải là Nam, Nữ hoặc Khác.", severity: "error" });
    if (!Number.isInteger(generation) || generation < 1 || generation > 99) issues.push({ row: rowNumber, field: "doi", code: "INVALID_GENERATION", message: "Đời phải là số nguyên từ 1 đến 99.", severity: "error" });
    const personId = value(row, "person_id") || undefined;
    if (mode === "create" && personId) issues.push({ row: rowNumber, field: "person_id", code: "PERSON_ID_NOT_ALLOWED", message: "Chế độ thêm mới không nhận person_id. Hãy chọn chế độ cập nhật cho file đã xuất từ hệ thống.", severity: "error" });
    if (mode === "update" && !personId) issues.push({ row: rowNumber, field: "person_id", code: "PERSON_ID_REQUIRED", message: "Chế độ cập nhật chỉ nhận file xuất từ hệ thống có person_id.", severity: "error" });
    if (mode === "update" && personId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(personId)) issues.push({ row: rowNumber, field: "person_id", code: "INVALID_PERSON_ID", message: "person_id không phải UUID do hệ thống xuất.", severity: "error" });
    const birthValue = value(row, "ngay_sinh");
    const birthPrecision = value(row, "do_chinh_xac_ngay_sinh");
    const birthCalendar = value(row, "loai_lich_ngay_sinh");
    if (birthValue && !validPartialDate(birthValue, birthPrecision)) issues.push({ row: rowNumber, field: "ngay_sinh", code: "INVALID_PARTIAL_DATE", message: "Ngày sinh không khớp độ chính xác year (YYYY), month (YYYY-MM) hoặc day (YYYY-MM-DD).", severity: "error" });
    if (birthCalendar && !["solar", "lunar"].includes(birthCalendar)) issues.push({ row: rowNumber, field: "loai_lich_ngay_sinh", code: "INVALID_CALENDAR", message: "Loại lịch phải là solar hoặc lunar.", severity: "error" });
    if (!rowId || !fullName || !gender || !Number.isInteger(generation)) continue;
    seen.add(rowId);
    rows.push({
      rowId,
      personId,
      fullName,
      searchName: normalizeVietnameseName(fullName),
      gender,
      generation,
      otherName: value(row, "ten_thuong_goi") || undefined,
      roleTitle: value(row, "vai_ve") || undefined,
      birthValue: birthValue || undefined,
      birthPrecision: (["year", "month", "day"].includes(birthPrecision) ? birthPrecision : undefined) as ImportPersonRow["birthPrecision"],
      birthCalendar: (birthCalendar === "lunar" ? "lunar" : "solar"),
      isDeceased: parseBoolean(value(row, "da_mat")),
      fatherRowId: value(row, "row_id_cha") || undefined,
      motherRowId: value(row, "row_id_me") || undefined,
      spouseRowIds: value(row, "row_id_vo_chong").split(",").map((item) => item.trim()).filter(Boolean),
      relationshipType: (["biological", "adoptive", "step", "guardian"].includes(value(row, "loai_quan_he")) ? value(row, "loai_quan_he") : "biological") as RelationshipType
    });
  }

  if (rows.length > 500) issues.push({ row: 0, code: "ROW_LIMIT", message: "Mỗi lần import tối đa 500 thành viên.", severity: "error" });
  const ids = new Set(rows.map((row) => row.rowId));
  for (const [index, row] of rows.entries()) {
    for (const [field, reference] of [["row_id_cha", row.fatherRowId], ["row_id_me", row.motherRowId]] as const) {
      if (reference && !ids.has(reference)) issues.push({ row: index + 2, field, code: "UNKNOWN_REFERENCE", message: `${field}=${reference} không tồn tại trong file.`, severity: "error" });
    }
    for (const spouse of row.spouseRowIds) if (!ids.has(spouse)) issues.push({ row: index + 2, field: "row_id_vo_chong", code: "UNKNOWN_REFERENCE", message: `row_id_vo_chong=${spouse} không tồn tại trong file.`, severity: "error" });
  }
  const cycle = detectRowCycle(rows);
  if (cycle) issues.push({ row: 0, code: "CYCLE", message: `Quan hệ cha/mẹ tạo chu trình: ${cycle.join(" → ")}.`, severity: "error" });

  const names = new Map<string, number[]>();
  rows.forEach((row, index) => names.set(row.searchName, [...(names.get(row.searchName) ?? []), index + 2]));
  for (const [name, rowNumbers] of names) if (rowNumbers.length > 1) issues.push({ row: rowNumbers[0], field: "ho_ten", code: "POSSIBLE_DUPLICATE", message: `Tên “${name}” xuất hiện ở các dòng ${rowNumbers.join(", ")}.`, severity: "warning" });

  return {
    rows,
    issues,
    stats: {
      rows: rows.length,
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      newPersons: rows.filter((row) => !row.personId).length,
      updates: rows.filter((row) => row.personId).length
    }
  };
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8F321F" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
}

export async function createExportWorkbook(tree?: FamilyTree) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GiaPhaVN";
  const members = workbook.addWorksheet("ThanhVien", { views: [{ state: "frozen", ySplit: 1 }] });
  members.addRow(COLUMNS);
  styleHeader(members.getRow(1));
  members.columns = COLUMNS.map((key) => ({ key, width: key.includes("ho_ten") ? 28 : key.includes("row_id") ? 20 : 18 }));

  if (tree) {
    const rowIdByPerson = new Map(tree.persons.map((person, index) => [person.id, `TV${String(index + 1).padStart(4, "0")}`]));
    const parents = new Map<string, string[]>();
    tree.parentageLinks.forEach((link) => parents.set(link.childId, [...(parents.get(link.childId) ?? []), link.parentId]));
    const spouses = new Map<string, string[]>();
    tree.unions.forEach((union) => union.partnerIds.forEach((id) => spouses.set(id, [...(spouses.get(id) ?? []), ...union.partnerIds.filter((partner) => partner !== id)])));
    for (const person of tree.persons.filter((item) => !item.archivedAt)) {
      const parentIds = parents.get(person.id) ?? [];
      const father = parentIds.map((id) => tree.persons.find((item) => item.id === id)).find((item) => item?.gender === "male");
      const mother = parentIds.map((id) => tree.persons.find((item) => item.id === id)).find((item) => item?.gender === "female");
      members.addRow({
        row_id: rowIdByPerson.get(person.id), person_id: person.id, ho_ten: person.fullName, gioi_tinh: person.gender === "male" ? "Nam" : person.gender === "female" ? "Nữ" : "Khác",
        doi: person.generation, ten_thuong_goi: person.otherName ?? "", vai_ve: person.roleTitle ?? "", ngay_sinh: person.birthDate?.value ?? "",
        do_chinh_xac_ngay_sinh: person.birthDate?.precision ?? "", loai_lich_ngay_sinh: person.birthDate?.calendar ?? "", da_mat: person.isDeceased ? "Có" : "Không",
        row_id_cha: father ? rowIdByPerson.get(father.id) : "", row_id_me: mother ? rowIdByPerson.get(mother.id) : "",
        row_id_vo_chong: (spouses.get(person.id) ?? []).map((id) => rowIdByPerson.get(id)).filter(Boolean).join(","), loai_quan_he: "biological"
      });
    }
  }

  members.autoFilter = { from: "A1", to: `O${Math.max(1, members.rowCount)}` };
  const guide = workbook.addWorksheet("HuongDan");
  guide.columns = [{ width: 24 }, { width: 90 }];
  guide.addRows([
    ["Mục", "Hướng dẫn"],
    ["row_id", "ID duy nhất trong file, ví dụ TV0001. Quan hệ phải tham chiếu ID này, không đoán theo họ tên."],
    ["person_id", "Để trống khi tạo mới. Không sửa cột này khi cập nhật file đã xuất từ hệ thống."],
    ["gioi_tinh", "Nam, Nữ hoặc Khác."],
    ["doi", "Số nguyên từ 1 đến 99."],
    ["ngày sinh", "Có thể nhập năm, tháng hoặc ngày; ghi độ chính xác year/month/day và lịch solar/lunar."],
    ["quan hệ", "row_id_cha, row_id_me và row_id_vo_chong phải tồn tại trong cùng file. Nhiều hôn phối ngăn cách bằng dấu phẩy."],
    ["loai_quan_he", "biological, adoptive, step hoặc guardian."],
    ["nguyên tắc", "Hệ thống kiểm tra toàn bộ trước. Nếu có một lỗi, không dòng nào được ghi."]
  ]);
  styleHeader(guide.getRow(1));
  guide.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  return workbook;
}
