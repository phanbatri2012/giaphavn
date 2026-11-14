"use client";

import { FormEvent, useState } from "react";
import { MailPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function InviteAdminButton({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); const email = new FormData(event.currentTarget).get("email");
    const response = await fetch(`/api/tenants/${tenantId}/invitations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "Đã gửi lời mời có hiệu lực 7 ngày." : result.error ?? "Không thể gửi lời mời.");
  }
  return <>{<button className="dashboard-secondary-button" type="button" onClick={() => setOpen(true)}><MailPlus /> Mời quản trị viên</button>}{open && <div className="dialog-backdrop" onMouseDown={() => setOpen(false)}><form className="tree-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><button className="dialog-close" type="button" onClick={() => setOpen(false)} aria-label="Đóng"><X /></button><h2>Mời quản trị viên</h2><p>Người được mời sẽ dùng tài khoản riêng. Hạn mức tính cả chủ sở hữu.</p><label>Email<input name="email" type="email" required autoFocus /></label>{message && <p role="status">{message}</p>}<button className="dashboard-primary-button">Gửi lời mời</button></form></div>}</>;
}

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter(); const [message, setMessage] = useState("");
  async function accept() { const response = await fetch(`/api/invitations/${token}/accept`, { method: "POST" }); const result = await response.json() as { error?: string }; if (!response.ok) return setMessage(result.error ?? "Không thể chấp nhận lời mời."); router.push("/app"); router.refresh(); }
  return <div><button className="button button-primary button-wide" onClick={accept}>Chấp nhận lời mời</button>{message && <p className="form-error" role="alert">{message}</p>}</div>;
}

