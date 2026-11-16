"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Settings2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FamilyTree } from "@/lib/domain/types";

export function TreeManagementActions({ tree }: { tree: FamilyTree }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
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
    if (response.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error ?? "Không thể lưu thiết lập.");
    }
    setSaving(false);
  }

  return <>
    <div className="tree-management-buttons">
      <button className="dashboard-secondary-button" type="button" onClick={() => { setError(""); setOpen(true); }}><Settings2 /> Thiết lập</button>
    </div>
    {open && <div className="dialog-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <form className="tree-dialog" onSubmit={saveSettings} onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" type="button" aria-label="Đóng" onClick={() => setOpen(false)}><X /></button>
        <span className="eyebrow"><i /><LockKeyhole /> Quyền riêng tư</span>
        <h2>Thiết lập phả đồ chính</h2>
        <label>Tên phả đồ<input name="name" required maxLength={120} defaultValue={tree.name} /></label>
        <label>Người gốc<select name="rootPersonId" defaultValue={tree.rootPersonId}>{tree.persons.map((person) => <option value={person.id} key={person.id}>{person.fullName}</option>)}</select></label>
        <label>Chế độ xem<select name="visibility" defaultValue={tree.visibility}><option value="public">Công khai</option><option value="protected">Có mã bảo mật</option></select></label>
        <label>Mã bảo mật mới<input name="accessCode" type="password" minLength={4} maxLength={100} placeholder={tree.visibility === "protected" ? "Để trống nếu giữ mã hiện tại" : "Nhập ít nhất 4 ký tự khi bật bảo vệ"} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="tree-dialog-actions"><button className="tenant-button" disabled={saving}>{saving ? "Đang lưu…" : "Lưu thiết lập"}</button></div>
      </form>
    </div>}
  </>;
}
