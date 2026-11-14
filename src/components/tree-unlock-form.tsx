"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function TreeUnlockForm({ treeId }: { treeId: string }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/public/trees/${treeId}/unlock`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: form.get("code"), turnstileToken: token }) });
    const result = await response.json() as { error?: string };
    setLoading(false);
    if (!response.ok) return setError(result.error ?? "Không thể mở phả đồ.");
    location.reload();
  }
  return <div className="tree-lock-card"><KeyRound /><span className="tenant-eyebrow">Phả đồ được bảo vệ</span><h2>Nhập mã do Ban tộc biểu cung cấp</h2><p>Mã đúng mở quyền xem trên thiết bị này trong 12 giờ. Thông tin riêng tư của người còn sống vẫn được ẩn.</p><form onSubmit={submit}><label htmlFor="tree-code">Mã bảo mật</label><input id="tree-code" name="code" type="password" minLength={4} maxLength={100} autoComplete="one-time-code" required /><TurnstileWidget action="tree_unlock" onToken={setToken} /><button className="tenant-button light" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : "Mở phả đồ"}</button>{error && <p className="form-error" role="alert">{error}</p>}</form></div>;
}
