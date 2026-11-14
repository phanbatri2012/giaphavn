"use client";

import { Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function ContactForm({ tenantId }: { tenantId: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch("/api/public/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...data, tenantId, turnstileToken: token })
    });
    setLoading(false);
    if (response.ok) {
      form.reset();
      setSent(true);
    } else {
      const result = await response.json() as { error?: string };
      setError(result.error ?? "Chưa thể gửi lời nhắn.");
    }
  }

  if (sent) {
    return (
      <div className="contact-success" role="status">
        <span>✓</span>
        <h3>Lời nhắn đã được ghi nhận</h3>
        <p>Ban tộc biểu sẽ liên hệ lại theo thông tin bạn cung cấp.</p>
        <button type="button" onClick={() => setSent(false)}>Gửi lời nhắn khác</button>
      </div>
    );
  }

  return (
    <form className="tenant-contact-form" onSubmit={submit}>
      <div className="form-two-columns">
        <label>Họ và tên<input name="name" required maxLength={100} /></label>
        <label>Email hoặc số điện thoại<input name="contact" required maxLength={120} /></label>
      </div>
      <label>Nội dung<textarea name="message" required maxLength={2000} rows={6} /></label>
      <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <TurnstileWidget action="public_contact" onToken={setToken} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="tenant-button" type="submit" disabled={loading}>
        <Send size={17} /> {loading ? "Đang gửi…" : "Gửi đến Ban tộc biểu"}
      </button>
    </form>
  );
}
