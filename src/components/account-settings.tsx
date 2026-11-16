"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { Download, HardDrive, LockKeyhole, RotateCcw, Save, ShieldCheck, Upload, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

type Settings = {
  profile: { fullName: string; email: string };
};

export function AccountSettings({ settings, localDemo = false }: { settings: Settings; localDemo?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName: form.get("fullName") })
    });
    setBusy(false);
    setMessage(response.ok ? "Đã cập nhật hồ sơ quản trị." : "Không thể cập nhật hồ sơ.");
    if (response.ok) router.refresh();
  }

  async function resetLocalDemo() {
    if (!window.confirm("Khôi phục dữ liệu mẫu ban đầu? Mọi chỉnh sửa local hiện tại sẽ bị xóa.")) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/demo/reset", { method: "POST" });
    const result = await response.json() as { error?: string };
    setBusy(false);
    setMessage(response.ok ? "Đã khôi phục dữ liệu mẫu local." : result.error ?? "Không thể khôi phục dữ liệu mẫu.");
    if (response.ok) router.refresh();
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setMessage("File sao lưu vượt quá 10 MB.");
      return;
    }
    if (!window.confirm(`Khôi phục từ ${file.name}? Dữ liệu hiện tại sẽ bị thay thế.`)) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/personal/backup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await file.text()
    });
    const result = await response.json() as { error?: string };
    setBusy(false);
    setMessage(response.ok ? "Đã khôi phục bản sao lưu." : result.error ?? "Không thể khôi phục bản sao lưu.");
    if (response.ok) router.refresh();
  }

  return <div className="dashboard-page">
    <div className="dashboard-welcome compact"><div><span>Personal Edition</span><h1>Cài đặt gia phả</h1><p>Quản lý hồ sơ chủ sở hữu, dữ liệu local và quyền riêng tư của một dòng họ.</p></div></div>
    {message && <p className={message.startsWith("Đã") ? "form-success" : "form-error"} role="status">{message}</p>}
    <div className="settings-sections">
      {localDemo && <section className="dashboard-panel settings-form"><h2><HardDrive /> Dữ liệu gia phả local</h2><p>Cây phả hệ, nội dung và cấu hình được lưu trong SQLite tại <code>.data</code>. File JSON sao lưu các dữ liệu này; ảnh nằm trong <code>.data/media</code>, vì vậy hãy sao chép cả thư mục <code>.data</code> để có bản sao đầy đủ.</p><div className="settings-actions"><a className="dashboard-secondary-button" href="/api/personal/backup" download><Download /> Tải bản sao lưu JSON</a><label className="dashboard-secondary-button" aria-disabled={busy}><Upload /> Khôi phục từ file<input className="visually-hidden" type="file" accept="application/json,.json" onChange={restoreBackup} disabled={busy} /></label><button className="dashboard-secondary-button" type="button" onClick={resetLocalDemo} disabled={busy}><RotateCcw /> Khôi phục dữ liệu mẫu</button></div></section>}
      <form className="dashboard-panel settings-form" onSubmit={saveProfile}><h2><UserRound /> Chủ sở hữu gia phả</h2><div className="settings-two"><label>Họ và tên<input name="fullName" defaultValue={settings.profile.fullName} /></label><label>Email tham chiếu<input defaultValue={settings.profile.email} disabled /></label></div><button className="dashboard-primary-button" disabled={busy}><Save /> Lưu thông tin</button></form>
      <section className="dashboard-panel settings-form"><h2><LockKeyhole /> Quyền riêng tư phả đồ</h2><p>Mã bảo mật, người gốc và trạng thái công khai được quản lý tại màn Phả đồ.</p><a className="dashboard-secondary-button" href="/admin/pha-do">Mở thiết lập phả đồ</a></section>
      <section className="dashboard-panel settings-form"><h2><ShieldCheck /> Bảo mật quản trị</h2><p>Phiên bản local hiện chỉ chạy trên máy cá nhân và không gửi email hoặc kết nối OAuth. Trước khi đưa lên Internet, trang <code>/admin</code> sẽ được bảo vệ bằng một mật khẩu quản trị đã hash Argon2id.</p></section>
    </div>
  </div>;
}
