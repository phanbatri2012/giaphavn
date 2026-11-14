"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, Eye, EyeOff, Mail, Pencil, PenLine, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AdminContact, AdminEvent, AdminPost } from "@/lib/repository/content";
import { RichTextEditor } from "@/components/rich-text-editor";

type Editing = { kind: "post"; item: AdminPost } | { kind: "event"; item: AdminEvent };

function localDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ContentManager({ tenantId, posts, events, contacts }: { tenantId: string; posts: AdminPost[]; events: AdminEvent[]; contacts: AdminContact[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"post" | "event">();
  const [editing, setEditing] = useState<Editing>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const activeKind = editing?.kind ?? dialog;

  function closeEditor() { setDialog(undefined); setEditing(undefined); setError(""); }

  async function saveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const kind = activeKind!;
    const payload = kind === "post" ? {
      kind, title: form.get("title"), excerpt: form.get("excerpt"), bodyHtml: form.get("bodyHtml"), category: form.get("category"), status: form.get("status")
    } : {
      kind, title: form.get("title"), description: form.get("description"), startsAt: new Date(String(form.get("startsAt"))).toISOString(), endsAt: form.get("endsAt") ? new Date(String(form.get("endsAt"))).toISOString() : undefined, lunarLabel: form.get("lunarLabel"), location: form.get("location"), status: form.get("status")
    };
    const target = editing ? `/api/tenants/${tenantId}/content/${kind}/${editing.item.id}` : `/api/tenants/${tenantId}/content`;
    const response = await fetch(target, { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setError(result.error ?? "Không thể lưu nội dung.");
    closeEditor(); router.refresh();
  }

  async function setStatus(kind: "post" | "event", id: string, status: "draft" | "published" | "archived") {
    const response = await fetch(`/api/tenants/${tenantId}/content/${kind}/${id}`, { method: status === "archived" ? "DELETE" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) router.refresh(); else setError("Không thể cập nhật trạng thái nội dung.");
  }

  async function setContactStatus(id: string, status: AdminContact["status"]) {
    const response = await fetch(`/api/tenants/${tenantId}/contacts/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) router.refresh();
  }

  const editingPost = editing?.kind === "post" ? editing.item : undefined;
  const editingEvent = editing?.kind === "event" ? editing.item : undefined;
  return <div className="dashboard-page">
    <div className="dashboard-welcome compact"><div><span>Nội dung website</span><h1>Bài viết, sự kiện & liên hệ</h1><p>Dữ liệu được lưu theo dòng họ; bản nháp không xuất hiện trên website công khai.</p></div><div className="content-create-actions"><button className="dashboard-secondary-button" onClick={() => setDialog("event")}><CalendarDays /> Tạo sự kiện</button><button className="dashboard-primary-button" onClick={() => setDialog("post")}><Plus /> Viết bài mới</button></div></div>
    {error && !activeKind && <p className="form-error" role="alert">{error}</p>}
    <div className="content-admin-grid">
      <section className="dashboard-panel content-list-panel"><div className="panel-heading"><div><span>{posts.length} nội dung</span><h2>Bài viết</h2></div><PenLine /></div>{posts.length ? posts.map((post) => <article key={post.id}><span className="content-icon"><PenLine /></span><div><small>{post.category} · {post.status === "published" ? "Đã xuất bản" : "Bản nháp"}</small><strong>{post.title}</strong><p>{post.excerpt}</p><div className="inline-actions"><button onClick={() => setEditing({ kind: "post", item: post })}><Pencil /> Chỉnh sửa</button><button onClick={() => setStatus("post", post.id, post.status === "published" ? "draft" : "published")}>{post.status === "published" ? <EyeOff /> : <Eye />}{post.status === "published" ? "Thu về nháp" : "Xuất bản"}</button><button onClick={() => setStatus("post", post.id, "archived")}><Trash2 /> Lưu trữ</button></div></div></article>) : <p className="empty-state">Chưa có bài viết.</p>}</section>
      <section className="dashboard-panel content-list-panel"><div className="panel-heading"><div><span>{events.length} lịch hẹn</span><h2>Sự kiện</h2></div><CalendarDays /></div>{events.length ? events.map((item) => <article key={item.id}><span className="calendar-badge"><b>{new Date(item.startsAt).getDate()}</b><small>Tháng {new Date(item.startsAt).getMonth() + 1}</small></span><div><small>{item.lunarLabel || (item.status === "published" ? "Đã xuất bản" : "Bản nháp")}</small><strong>{item.title}</strong><p>{item.location}</p><div className="inline-actions"><button onClick={() => setEditing({ kind: "event", item })}><Pencil /> Chỉnh sửa</button><button onClick={() => setStatus("event", item.id, item.status === "published" ? "draft" : "published")}>{item.status === "published" ? <EyeOff /> : <Eye />}{item.status === "published" ? "Thu về nháp" : "Xuất bản"}</button><button onClick={() => setStatus("event", item.id, "archived")}><Trash2 /> Lưu trữ</button></div></div></article>) : <p className="empty-state">Chưa có sự kiện.</p>}</section>
    </div>
    <section className="dashboard-panel contact-inbox"><div className="panel-heading"><div><span>Hộp thư Ban tộc biểu</span><h2>Lời nhắn gần đây</h2></div><Mail /></div>{contacts.length ? contacts.map((contact) => <article key={contact.id} className={contact.status === "unread" ? "unread" : ""}><div><strong>{contact.name}</strong><small>{contact.email ?? contact.phone ?? "Không để lại liên hệ"} · {new Intl.DateTimeFormat("vi-VN").format(new Date(contact.createdAt))}</small><p>{contact.message}</p></div><select aria-label={`Trạng thái lời nhắn của ${contact.name}`} value={contact.status} onChange={(event) => setContactStatus(contact.id, event.target.value as AdminContact["status"])}><option value="unread">Chưa đọc</option><option value="read">Đã đọc</option><option value="resolved">Đã xử lý</option></select></article>) : <p className="empty-state">Chưa có lời nhắn.</p>}</section>
    {activeKind && <div className="dialog-backdrop" role="presentation" onMouseDown={closeEditor}><form className="tree-dialog content-editor-dialog" onSubmit={saveContent} onMouseDown={(event) => event.stopPropagation()}><button className="dialog-close" type="button" onClick={closeEditor} aria-label="Đóng"><X /></button><span className="eyebrow"><i />{activeKind === "post" ? "Bài viết" : "Sự kiện"}</span><h2>{editing ? "Chỉnh sửa nội dung" : activeKind === "post" ? "Viết bài mới" : "Tạo sự kiện"}</h2><label>Tiêu đề<input name="title" required maxLength={220} autoFocus defaultValue={editing?.item.title} /></label>{activeKind === "post" ? <><label>Chuyên mục<input name="category" defaultValue={editingPost?.category ?? "Tin dòng họ"} maxLength={100} /></label><label>Tóm tắt<textarea name="excerpt" rows={2} maxLength={500} defaultValue={editingPost?.excerpt} /></label><label>Nội dung<RichTextEditor key={editingPost?.id ?? "new-post"} name="bodyHtml" initialHtml={editingPost?.bodyHtml} /></label></> : <><div className="settings-two"><label>Thời gian bắt đầu<input name="startsAt" type="datetime-local" required defaultValue={localDateTime(editingEvent?.startsAt)} /></label><label>Thời gian kết thúc<input name="endsAt" type="datetime-local" defaultValue={localDateTime(editingEvent?.endsAt)} /></label></div><label>Ngày âm hiển thị thủ công<input name="lunarLabel" maxLength={120} defaultValue={editingEvent?.lunarLabel} /></label><label>Địa điểm<input name="location" maxLength={500} defaultValue={editingEvent?.location} /></label><label>Mô tả<textarea name="description" rows={5} maxLength={10000} defaultValue={editingEvent?.description} /></label></>}<label>Trạng thái<select name="status" defaultValue={editing?.item.status ?? "draft"}><option value="draft">Lưu nháp</option><option value="published">Xuất bản ngay</option></select></label>{error && <p className="form-error">{error}</p>}<button className="tenant-button" disabled={saving}>{saving ? "Đang lưu…" : "Lưu nội dung"}</button></form></div>}
  </div>;
}
