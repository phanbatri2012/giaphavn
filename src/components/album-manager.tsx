"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, ImagePlus, Images, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AdminAlbum } from "@/lib/repository/content";

export function AlbumManager({ tenantId, albums }: { tenantId: string; albums: AdminAlbum[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminAlbum>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = { kind: "album", title: form.get("title"), description: form.get("description"), youtubeUrl: form.get("youtubeUrl"), status: form.get("status") };
    const response = await fetch(editing ? `/api/tenants/${tenantId}/content/album/${editing.id}` : `/api/tenants/${tenantId}/content`, { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error ?? "Không thể lưu album.");
    setCreating(false); setEditing(undefined); router.refresh();
  }

  async function setStatus(album: AdminAlbum, status: "draft" | "published" | "archived") {
    const response = await fetch(`/api/tenants/${tenantId}/content/album/${album.id}`, { method: status === "archived" ? "DELETE" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) router.refresh(); else setMessage("Không thể cập nhật trạng thái album.");
  }

  async function removeImage(id: string) {
    if (!window.confirm("Xóa ảnh này khỏi album và ổ đĩa local?")) return;
    setSaving(true); const response = await fetch(`/api/personal/media/${id}`, { method: "DELETE" }); setSaving(false);
    if (response.ok) router.refresh(); else setMessage("Không thể xóa ảnh.");
  }

  async function upload(album: AdminAlbum, files: FileList | null) {
    if (!files?.length) return;
    setSaving(true); setMessage("");
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.set("file", file);
      form.set("tenantId", tenantId);
      form.set("albumId", album.id);
      form.set("alt", album.title);
      form.set("isPublic", String(album.status === "published"));
      const uploadResponse = await fetch("/api/personal/media", { method: "POST", body: form });
      const result = await uploadResponse.json() as { error?: string };
      if (!uploadResponse.ok) { setMessage(result.error ?? `Không thể tải ${file.name}.`); break; }
    }
    setSaving(false); router.refresh();
  }

  const formAlbum = editing;
  return <div className="dashboard-page">
    <div className="dashboard-welcome compact"><div><span>Ảnh được giữ riêng tư cho đến khi album xuất bản</span><h1>Thư viện dòng họ</h1><p>Tạo album, tải ảnh và liên kết video YouTube mà không làm lộ đường dẫn Storage.</p></div><button className="dashboard-primary-button" onClick={() => { setMessage(""); setCreating(true); }}><Plus /> Tạo album</button></div>
    {message && <p className={message.startsWith("Đã") ? "form-success" : "form-error"} role="status">{message}</p>}
    <div className="admin-album-grid">{albums.map((album, index) => <article className="dashboard-panel" key={album.id}>
      <div className={`admin-album-art art-${index % 3 + 1}`}><Images /></div><span className={`status-chip ${album.status === "published" ? "active" : "neutral"}`}>{album.status === "published" ? "Đã xuất bản" : "Bản nháp"}</span>
      <h2>{album.title}</h2><p>{album.description}</p><span>{album.imageCount} ảnh{album.youtubeUrl ? " · Có YouTube" : ""}</span>
      {album.images.length > 0 && <div className="admin-photo-grid">{album.images.map((photo) => <figure key={photo.id}><Image src={photo.url} alt={photo.alt} width={180} height={130} unoptimized /><button type="button" onClick={() => removeImage(photo.id)} aria-label={`Xóa ${photo.alt}`}><Trash2 /></button></figure>)}</div>}
      <div className="album-actions"><label className="dashboard-secondary-button"><ImagePlus /> Thêm ảnh<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden disabled={saving} onChange={(event) => upload(album, event.target.files)} /></label><button onClick={() => setEditing(album)} aria-label={`Sửa ${album.title}`}><Pencil /></button><button onClick={() => setStatus(album, album.status === "published" ? "draft" : "published")}>{album.status === "published" ? <EyeOff /> : <Eye />}</button><button onClick={() => setStatus(album, "archived")} aria-label={`Lưu trữ ${album.title}`}><Trash2 /></button></div>
    </article>)}</div>
    {(creating || editing) && <div className="dialog-backdrop" role="presentation" onMouseDown={() => { setCreating(false); setEditing(undefined); }}><form className="tree-dialog" onSubmit={saveAlbum} onMouseDown={(event) => event.stopPropagation()}><button className="dialog-close" type="button" onClick={() => { setCreating(false); setEditing(undefined); }} aria-label="Đóng"><X /></button><span className="eyebrow"><i />Thư viện</span><h2>{editing ? "Chỉnh sửa album" : "Tạo album"}</h2><label>Tên album<input name="title" required maxLength={220} autoFocus defaultValue={formAlbum?.title} /></label><label>Mô tả<textarea name="description" rows={4} maxLength={5000} defaultValue={formAlbum?.description} /></label><label>Liên kết YouTube<input name="youtubeUrl" type="url" maxLength={500} defaultValue={formAlbum?.youtubeUrl} placeholder="https://youtube.com/watch?v=…" /></label><label>Trạng thái<select name="status" defaultValue={formAlbum?.status ?? "draft"}><option value="draft">Lưu nháp</option><option value="published">Xuất bản ngay</option></select></label>{message && <p className="form-error">{message}</p>}<button className="tenant-button" disabled={saving}>{saving ? "Đang lưu…" : "Lưu album"}</button></form></div>}
  </div>;
}
