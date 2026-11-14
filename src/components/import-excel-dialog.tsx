"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, LoaderCircle, X } from "lucide-react";
import { FormEvent, useState } from "react";

type Preview = {
  jobId: string | null;
  canCommit: boolean;
  stats: { rows: number; errors: number; warnings: number; newPersons: number; updates: number };
  issues: Array<{ row: number; field?: string; message: string; severity: "error" | "warning" }>;
};

export function ImportExcelDialog({ treeId, onClose }: { treeId: string; onClose: () => void }) {
  const [preview, setPreview] = useState<Preview>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function previewFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    const response = await fetch(`/api/trees/${treeId}/imports/preview`, { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json() as Preview & { error?: string };
    setLoading(false);
    if (!response.ok) return setMessage(result.error ?? "Không thể kiểm tra file.");
    setPreview(result);
  }
  async function commit() {
    if (!preview?.jobId) return;
    setLoading(true);
    const response = await fetch(`/api/trees/${treeId}/imports/commit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: preview.jobId, acceptWarnings: preview.stats.warnings > 0 }) });
    const result = await response.json() as { error?: string };
    setLoading(false);
    if (!response.ok) return setMessage(result.error ?? "Không thể import dữ liệu.");
    setMessage("Import đã hoàn tất. Hãy tải lại trang để xem dữ liệu mới.");
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}><button className="dialog-close" type="button" onClick={onClose} aria-label="Đóng"><X /></button><FileSpreadsheet className="import-icon" /><h2 id="import-title">Nhập thành viên từ Excel</h2><p>Hệ thống kiểm tra toàn bộ trước khi ghi. Quan hệ dùng <code>row_id</code>, không ghép theo họ tên. <a href={`/api/trees/${treeId}/imports/template`}>Tải file mẫu</a>.</p>{!preview && <form onSubmit={previewFile}><label>Chế độ<select name="mode" defaultValue="create"><option value="create">Thêm mới</option><option value="update">Cập nhật từ file đã xuất</option></select></label><label>File .xlsx<input name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label><button className="dashboard-primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : "Kiểm tra file"}</button></form>}{preview && <div className="import-preview"><div className="import-stats"><span><strong>{preview.stats.rows}</strong>Dòng</span><span><strong>{preview.stats.newPersons}</strong>Thêm mới</span><span><strong>{preview.stats.errors}</strong>Lỗi</span><span><strong>{preview.stats.warnings}</strong>Cảnh báo</span></div>{preview.issues.length > 0 && <ul>{preview.issues.slice(0, 30).map((issue, index) => <li className={issue.severity} key={`${issue.row}-${index}`}>{issue.severity === "error" ? <AlertTriangle /> : <CheckCircle2 />}<span><strong>Dòng {issue.row || "—"}{issue.field ? ` · ${issue.field}` : ""}</strong>{issue.message}</span></li>)}</ul>}<div className="import-actions"><button type="button" onClick={() => setPreview(undefined)}>Chọn file khác</button><button className="dashboard-primary-button" type="button" disabled={!preview.canCommit || loading} onClick={commit}>{loading ? <LoaderCircle className="spin" /> : "Xác nhận ghi dữ liệu"}</button></div></div>}{message && <p className={message.startsWith("Import") ? "form-success" : "form-error"} role="status">{message}</p>}</section></div>;
}
