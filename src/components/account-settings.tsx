"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { HardDrive, LockKeyhole, Mail, RotateCcw, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { InviteAdminButton } from "@/components/invitation-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Settings = {
  profile: { fullName: string; email: string };
  admins: Array<{ userId: string; fullName: string; role: "owner" | "admin" }>;
  invitations: Array<{ id: string; email: string; expiresAt: string }>;
  mfaEnabled: boolean;
  deletionRequestedAt?: string;
  purgeAfter?: string;
};

export function AccountSettings({ tenantId, settings, localDemo = false }: { tenantId: string; settings: Settings; localDemo?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState<{ factorId: string; qrCode: string }>();
  const [mfaCode, setMfaCode] = useState("");

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: form.get("fullName") }) });
    setBusy(false); setMessage(response.ok ? "Đã cập nhật hồ sơ." : "Không thể cập nhật hồ sơ.");
    if (response.ok) router.refresh();
  }

  async function removeAdmin(userId: string) {
    if (!window.confirm("Xóa quyền quản trị của tài khoản này?")) return;
    setBusy(true); const response = await fetch(`/api/tenants/${tenantId}/admins/${userId}`, { method: "DELETE" }); setBusy(false);
    if (response.ok) router.refresh(); else setMessage("Không thể xóa quản trị viên.");
  }

  async function beginMfa() {
    setBusy(true); setMessage("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setBusy(false); return setMessage("MFA cần Supabase Auth."); }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "GiaPhaVN" });
    setBusy(false);
    if (error) return setMessage(error.message);
    setMfa({ factorId: data.id, qrCode: data.totp.qr_code });
  }

  async function verifyMfa() {
    if (!mfa || !/^\d{6}$/.test(mfaCode)) return setMessage("Nhập mã xác thực gồm 6 chữ số.");
    setBusy(true); setMessage("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setBusy(false); return; }
    const challenge = await supabase.auth.mfa.challenge({ factorId: mfa.factorId });
    if (challenge.error) { setBusy(false); return setMessage(challenge.error.message); }
    const verification = await supabase.auth.mfa.verify({ factorId: mfa.factorId, challengeId: challenge.data.id, code: mfaCode });
    setBusy(false);
    if (verification.error) return setMessage(verification.error.message);
    setMfa(undefined); setMessage("Đã bật xác thực hai bước."); router.refresh();
  }

  async function changeDeletion(action: "request" | "cancel") {
    if (action === "request" && !window.confirm("Yêu cầu xóa toàn bộ dòng họ sau 30 ngày? Website sẽ ngừng xuất bản ngay.")) return;
    setBusy(true);
    const response = await fetch(`/api/tenants/${tenantId}/deletion`, { method: action === "request" ? "POST" : "DELETE" });
    setBusy(false);
    setMessage(response.ok ? action === "request" ? "Đã lên lịch xóa dữ liệu sau 30 ngày." : "Đã hủy yêu cầu xóa dữ liệu." : "Không thể cập nhật yêu cầu xóa.");
    if (response.ok) router.refresh();
  }

  async function resetLocalDemo() {
    if (!window.confirm("Khôi phục dữ liệu mẫu ban đầu? Mọi chỉnh sửa local hiện tại sẽ bị xóa.")) return;
    setBusy(true); setMessage("");
    const response = await fetch("/api/demo/reset", { method: "POST" });
    const result = await response.json() as { error?: string };
    setBusy(false);
    setMessage(response.ok ? "Đã khôi phục dữ liệu mẫu local." : result.error ?? "Không thể khôi phục dữ liệu mẫu.");
    if (response.ok) router.refresh();
  }

  return <div className="dashboard-page">
    <div className="dashboard-welcome compact"><div><span>Tài khoản & bảo mật</span><h1>Cài đặt dòng họ</h1><p>Quản lý hồ sơ, người cùng chăm sóc phả đồ và vòng đời dữ liệu.</p></div></div>
    {message && <p className={message.startsWith("Đã") ? "form-success" : "form-error"} role="status">{message}</p>}
    <div className="settings-sections">
      {localDemo && <section className="dashboard-panel settings-form"><h2><HardDrive /> Dữ liệu thử nghiệm local</h2><p>Các thay đổi phả đồ đang được lưu trong thư mục <code>.data</code> trên máy này và không được đưa lên Git.</p><button className="dashboard-secondary-button" type="button" onClick={resetLocalDemo} disabled={busy}><RotateCcw /> Khôi phục dữ liệu mẫu</button></section>}
      <form className="dashboard-panel settings-form" onSubmit={saveProfile}><h2><UserRound /> Thông tin tài khoản</h2><div className="settings-two"><label>Họ và tên<input name="fullName" defaultValue={settings.profile.fullName} /></label><label>Email<input defaultValue={settings.profile.email} disabled /></label></div><button className="dashboard-primary-button" disabled={busy}><Save /> Lưu thông tin</button></form>
      <section className="dashboard-panel settings-form"><h2><ShieldCheck /> Xác thực hai bước</h2>{settings.mfaEnabled ? <p className="form-success">Tài khoản đã bảo vệ bằng TOTP. Operator phải duy trì AAL2 để mở trang vận hành.</p> : <><p>Dùng ứng dụng xác thực để tăng bảo vệ cho tài khoản quản trị.</p>{!mfa ? <button className="dashboard-secondary-button" type="button" onClick={beginMfa} disabled={busy}>Thiết lập MFA</button> : <div className="mfa-enrollment"><Image src={mfa.qrCode} alt="Mã QR thiết lập MFA" width={180} height={180} unoptimized /><label>Mã 6 chữ số<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} /></label><button className="dashboard-primary-button" type="button" onClick={verifyMfa} disabled={busy}>Xác minh và bật</button></div>}</>}</section>
      <section className="dashboard-panel settings-form"><h2><LockKeyhole /> Quyền riêng tư phả đồ</h2><p>Mã bảo mật, người gốc và trạng thái public/protected được quản lý riêng cho từng phả đồ tại màn Phả đồ.</p><a className="dashboard-secondary-button" href="/app/pha-do">Mở thiết lập phả đồ</a></section>
      <section className="dashboard-panel settings-form"><h2><Mail /> Quản trị viên</h2>{settings.admins.map((admin) => <div className="admin-user-row" key={admin.userId}><span>{admin.fullName.charAt(0)}</span><div><strong>{admin.fullName}</strong><small>{admin.role === "owner" ? "Chủ sở hữu" : "Quản trị viên"}</small></div>{admin.role === "owner" ? <ShieldCheck /> : <button type="button" aria-label={`Xóa ${admin.fullName}`} onClick={() => removeAdmin(admin.userId)} disabled={busy}><Trash2 /></button>}</div>)}{settings.invitations.map((invitation) => <div className="admin-user-row pending" key={invitation.id}><span>?</span><div><strong>{invitation.email}</strong><small>Chờ chấp nhận · hết hạn {new Intl.DateTimeFormat("vi-VN").format(new Date(invitation.expiresAt))}</small></div></div>)}<InviteAdminButton tenantId={tenantId} /></section>
      <section className="dashboard-panel settings-form danger-zone"><h2><Trash2 /> Xóa dòng họ</h2>{settings.deletionRequestedAt ? <><p>Đã yêu cầu xóa. Dữ liệu dự kiến purge {settings.purgeAfter ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(new Date(settings.purgeAfter)) : "sau 30 ngày"}.</p><button className="dashboard-secondary-button" type="button" onClick={() => changeDeletion("cancel")} disabled={busy}>Hủy yêu cầu xóa</button></> : <><p>Website ngừng xuất bản ngay. Database và Storage chỉ bị purge sau 30 ngày.</p><button className="danger-button" type="button" onClick={() => changeDeletion("request")} disabled={busy}>Yêu cầu xóa dữ liệu</button></>}</section>
    </div>
  </div>;
}
