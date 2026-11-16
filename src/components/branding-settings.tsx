"use client";

import { FormEvent, useState } from "react";
import { ExternalLink, ImagePlus, Palette, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TenantBranding } from "@/lib/repository/settings";

export function BrandingSettings({ initial }: { initial: TenantBranding }) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [bannerUrl, setBannerUrl] = useState(initial.bannerUrl);
  const [published, setPublished] = useState(initial.published);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File, target: "logo" | "banner") {
    setSaving(true); setMessage("");
    const form = new FormData();
    form.set("file", file);
    form.set("tenantId", initial.id);
    form.set("isPublic", "true");
    const finalResponse = await fetch("/api/personal/media", { method: "POST", body: form });
    const final = await finalResponse.json() as { publicUrl?: string; error?: string };
    setSaving(false);
    if (!finalResponse.ok || !final.publicUrl) return setMessage(final.error ?? "Không thể hoàn tất ảnh.");
    if (target === "logo") setLogoUrl(final.publicUrl); else setBannerUrl(final.publicUrl);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch(`/api/tenants/${initial.id}/settings`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, logoUrl, bannerUrl, published }) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error ?? "Không thể lưu thay đổi.");
    setMessage("Đã lưu thông tin website."); router.refresh();
  }

  return <form className="dashboard-page" onSubmit={save}><div className="dashboard-welcome compact"><div><span>Website dòng họ</span><h1>Giao diện & thông tin</h1><p>Một theme di sản hiện đại, tùy chỉnh màu sắc, hình ảnh, SEO và trạng thái xuất bản.</p></div><Link className="dashboard-secondary-button" href="/" target="_blank"><ExternalLink /> Xem bản xem trước</Link></div>{message && <p className={message.startsWith("Đã") ? "form-success" : "form-error"} role="status">{message}</p>}<div className="appearance-grid"><section className="dashboard-panel settings-form"><h2>Thông tin hiển thị</h2><label>Tên đầy đủ<input name="name" defaultValue={initial.name} required /></label><label>Tên ngắn<input name="shortName" defaultValue={initial.shortName} required /></label><label>Lời giới thiệu<textarea name="introduction" rows={4} defaultValue={initial.introduction} /></label><label>Phả ký<textarea name="chronicle" rows={8} defaultValue={initial.chronicle} /></label><div className="settings-two"><label>Email liên hệ<input name="contactEmail" type="email" defaultValue={initial.contactEmail} /></label><label>Số điện thoại<input name="contactPhone" defaultValue={initial.contactPhone} /></label></div><label>Địa chỉ<input name="address" defaultValue={initial.address} /></label><label>Liên kết bản đồ<input name="mapUrl" type="url" defaultValue={initial.mapUrl} /></label><h2>SEO</h2><label>Tiêu đề SEO<input name="seoTitle" maxLength={160} defaultValue={initial.seoTitle} /></label><label>Mô tả SEO<textarea name="seoDescription" rows={3} maxLength={320} defaultValue={initial.seoDescription} /></label></section><section className="dashboard-panel theme-panel"><h2><Palette /> Màu sắc & hình ảnh</h2><label>Màu chủ đạo<input name="primaryColor" type="color" defaultValue={initial.primaryColor} /></label><label>Màu nhấn<input name="accentColor" type="color" defaultValue={initial.accentColor} /></label><div className="upload-placeholder"><ImagePlus /><strong>Logo dòng họ</strong><small>JPG, PNG hoặc WEBP · tối đa 10 MB</small>{logoUrl && <code>{logoUrl}</code>}<label className="dashboard-secondary-button">Chọn logo<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => event.target.files?.[0] && upload(event.target.files[0], "logo")} /></label></div><div className="upload-placeholder"><ImagePlus /><strong>Banner hoặc ảnh nhà thờ tộc</strong>{bannerUrl && <code>{bannerUrl}</code>}<label className="dashboard-secondary-button">Chọn banner<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => event.target.files?.[0] && upload(event.target.files[0], "banner")} /></label></div><label className="toggle-row"><span><strong>Xuất bản website</strong><small>Tắt để website không xuất hiện công khai và không được index.</small></span><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /></label><button className="dashboard-primary-button" disabled={saving}><Save /> {saving ? "Đang lưu…" : "Lưu thay đổi"}</button></section></div></form>;
}
