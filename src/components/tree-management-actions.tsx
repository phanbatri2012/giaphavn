"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Plus, Settings2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FamilyTree } from "@/lib/domain/types";

export function TreeManagementActions({ tenantId, tree, treeCount }: { tenantId: string; tree: FamilyTree; treeCount: number }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"create" | "settings">();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createTree(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/tenants/${tenantId}/trees`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), rootPersonName: form.get("rootPersonName"), rootPersonGender: form.get("rootPersonGender") })
    });
    const result = await response.json() as { treeId?: string; error?: string };
    if (response.ok && result.treeId) {
      await fetch("/api/context", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId, treeId: result.treeId }) });
      setDialog(undefined); router.refresh();
    } else setError(result.error ?? "Không thể tạo phả đồ.");
    setSaving(false);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/trees/${tree.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: tree.graphVersion,
        name: form.get("name"),
        rootPersonId: form.get("rootPersonId"),
        visibility: form.get("visibility"),
        accessCode: String(form.get("accessCode") ?? "") || undefined
      })
    });
    const result = await response.json() as { error?: string };
    if (response.ok) { setDialog(undefined); router.refresh(); }
    else setError(result.error ?? "Không thể lưu thiết lập.");
    setSaving(false);
  }

  async function archiveTree() {
    if (treeCount <= 1 || !window.confirm(`Lưu trữ phả đồ “${tree.name}”? Dữ liệu sẽ không xuất hiện trên website.`)) return;
    setSaving(true); setError("");
    const response = await fetch(`/api/trees/${tree.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: tree.graphVersion }) });
    const result = await response.json() as { error?: string };
    if (response.ok) {
      await fetch("/api/context", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId }) });
      setDialog(undefined); router.refresh();
    } else setError(result.error ?? "Không thể lưu trữ phả đồ.");
    setSaving(false);
  }

  return <>
    <div className="tree-management-buttons">
      <button className="dashboard-secondary-button" type="button" onClick={() => { setError(""); setDialog("settings"); }}><Settings2 /> Thiết lập</button>
      <button className="dashboard-primary-button" type="button" onClick={() => { setError(""); setDialog("create"); }} disabled={treeCount >= 5}><Plus /> Phả đồ mới</button>
    </div>
    {dialog && <div className="dialog-backdrop" role="presentation" onMouseDown={() => setDialog(undefined)}>
      {dialog === "create" ? <form className="tree-dialog" onSubmit={createTree} onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" type="button" aria-label="Đóng" onClick={() => setDialog(undefined)}><X /></button>
        <span className="eyebrow"><i />{treeCount} / 5 phả đồ</span>
        <h2>Tạo phả đồ mới</h2>
        <label>Tên phả đồ<input name="name" required maxLength={120} placeholder="Ví dụ: Chi thứ hai" autoFocus /></label>
        <label>Thành viên gốc<input name="rootPersonName" required maxLength={150} /></label>
        <label>Giới tính<select name="rootPersonGender" defaultValue="male"><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="tenant-button" disabled={saving}>{saving ? "Đang tạo…" : "Tạo phả đồ"}</button>
      </form> : <form className="tree-dialog" onSubmit={saveSettings} onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" type="button" aria-label="Đóng" onClick={() => setDialog(undefined)}><X /></button>
        <span className="eyebrow"><i /><LockKeyhole /> Quyền riêng tư</span>
        <h2>Thiết lập phả đồ</h2>
        <label>Tên phả đồ<input name="name" required maxLength={120} defaultValue={tree.name} /></label>
        <label>Người gốc<select name="rootPersonId" defaultValue={tree.rootPersonId}>{tree.persons.map((person) => <option value={person.id} key={person.id}>{person.fullName}</option>)}</select></label>
        <label>Chế độ xem<select name="visibility" defaultValue={tree.visibility}><option value="public">Công khai</option><option value="protected">Có mã bảo mật</option></select></label>
        <label>Mã bảo mật mới<input name="accessCode" type="password" minLength={4} maxLength={100} placeholder={tree.visibility === "protected" ? "Để trống nếu giữ mã hiện tại" : "Bắt buộc khi chuyển sang protected"} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="tree-dialog-actions"><button className="danger-button" type="button" onClick={archiveTree} disabled={saving || treeCount <= 1}><Trash2 /> Lưu trữ</button><button className="tenant-button" disabled={saving}>{saving ? "Đang lưu…" : "Lưu thiết lập"}</button></div>
      </form>}
    </div>}
  </>;
}
