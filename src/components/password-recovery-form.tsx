"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PasswordRecoveryForm({ mode }: { mode: "request" | "update" }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage(""); setError("");
    const form = new FormData(event.currentTarget);
    if (mode === "update" && form.get("password") !== form.get("confirm")) {
      setLoading(false); setError("Hai mật khẩu chưa trùng khớp."); return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setLoading(false); setMessage("Chế độ demo: yêu cầu đã được mô phỏng."); return; }
    const result = mode === "request"
      ? await supabase.auth.resetPasswordForEmail(String(form.get("email")), { redirectTo: `${location.origin}/auth/callback?next=/dat-lai-mat-khau` })
      : await supabase.auth.updateUser({ password: String(form.get("password")) });
    setLoading(false);
    if (result.error) return setError(result.error.message);
    setMessage(mode === "request" ? "Đã gửi email đặt lại mật khẩu. Hãy kiểm tra hộp thư và thư rác." : "Mật khẩu đã được cập nhật. Bạn có thể quay lại trang quản trị.");
  }
  return <form className="auth-form" onSubmit={submit}>{mode === "request" ? <label>Email tài khoản<input name="email" type="email" autoComplete="email" required /></label> : <><label>Mật khẩu mới<input name="password" type="password" minLength={10} autoComplete="new-password" required /></label><label>Nhập lại mật khẩu<input name="confirm" type="password" minLength={10} autoComplete="new-password" required pattern=".{10,}" /></label></>}{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<button className="button button-primary button-wide" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : mode === "request" ? "Gửi liên kết đặt lại" : "Lưu mật khẩu mới"}</button></form>;
}
