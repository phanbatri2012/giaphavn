"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function OnboardingForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/tenants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    setLoading(false);
    if (!response.ok) return setError(result.error ?? "Không thể tạo dòng họ.");
    router.push("/app"); router.refresh();
  }
  return <form className="auth-form onboarding-form" onSubmit={submit}><label>Tên dòng họ<input name="name" required minLength={2} maxLength={160} placeholder="Gia phả họ Nguyễn — Đà Nẵng" /></label><label>Địa chỉ website<div className="slug-input"><input name="slug" required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" placeholder="ho-nguyen-da-nang" /><span>.giaphavn.vn</span></div><small>Chỉ chữ thường không dấu, số và dấu gạch ngang.</small></label><div className="form-two-columns"><label>Người gốc<input name="rootPersonName" required minLength={2} maxLength={150} /></label><label>Giới tính<select name="rootPersonGender" defaultValue="male"><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-wide" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : "Tạo phả đồ đầu tiên"}</button></form>;
}

