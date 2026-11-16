import "server-only";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeContentHtml } from "@/lib/security/sanitize-content";
import { isPersonalEdition } from "@/lib/personal/mode";
import { getPersonalSiteState } from "@/lib/personal/site-store";

export type AdminPost = { id: string; title: string; slug: string; excerpt: string; bodyText: string; bodyHtml: string; category: string; status: "draft" | "published" | "archived"; publishedAt?: string };
export type AdminEvent = { id: string; title: string; description: string; startsAt: string; endsAt?: string; lunarLabel?: string; location: string; status: "draft" | "published" | "archived" };
export type AdminAlbum = { id: string; title: string; description: string; coverUrl?: string; youtubeUrl?: string; imageCount: number; images: Array<{ id: string; url: string; alt: string }>; status: "draft" | "published" | "archived" };
export type AdminContact = { id: string; name: string; email?: string; phone?: string; message: string; status: "unread" | "read" | "resolved"; createdAt: string };

function htmlToText(value?: string | null) {
  return (value ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
}

export async function getAdminContent(tenantId: string) {
  if (isPersonalEdition() || !hasSupabaseConfig()) {
    const state = await getPersonalSiteState();
    if (state.branding.id !== tenantId) throw new Error("PERSONAL_TENANT_NOT_FOUND");
    return {
      posts: state.posts.filter((item) => item.status !== "archived"),
      events: state.events.filter((item) => item.status !== "archived"),
      albums: state.albums.filter((item) => item.status !== "archived"),
      contacts: state.contacts
    };
  }
  const supabase = await createSupabaseServerClient();
  const [posts, events, albums, media, contacts] = await Promise.all([
    supabase.from("posts").select("id, title, slug, excerpt, body_html, category, status, published_at").eq("tenant_id", tenantId).neq("status", "archived").order("updated_at", { ascending: false }),
    supabase.from("events").select("id, title, description, starts_at, ends_at, lunar_label, location, status").eq("tenant_id", tenantId).neq("status", "archived").order("starts_at"),
    supabase.from("albums").select("id, title, description, cover_url, youtube_url, image_count, status").eq("tenant_id", tenantId).neq("status", "archived").order("updated_at", { ascending: false }),
    supabase.from("media_assets").select("id, album_id, alt_text").eq("tenant_id", tenantId).not("album_id", "is", null).order("created_at"),
    supabase.from("contact_messages").select("id, name, email, phone, message, status, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100)
  ]);
  if (posts.error || events.error || albums.error || media.error || contacts.error) throw posts.error ?? events.error ?? albums.error ?? media.error ?? contacts.error;
  return {
    posts: (posts.data ?? []).map((row) => ({ id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt ?? "", bodyText: htmlToText(row.body_html), bodyHtml: sanitizeContentHtml(row.body_html ?? ""), category: row.category ?? "Tin dòng họ", status: row.status, publishedAt: row.published_at ?? undefined } as AdminPost)),
    events: (events.data ?? []).map((row) => ({ id: row.id, title: row.title, description: row.description ?? "", startsAt: row.starts_at, endsAt: row.ends_at ?? undefined, lunarLabel: row.lunar_label ?? undefined, location: row.location ?? "", status: row.status } as AdminEvent)),
    albums: (albums.data ?? []).map((row) => ({ id: row.id, title: row.title, description: row.description ?? "", coverUrl: row.cover_url ?? undefined, youtubeUrl: row.youtube_url ?? undefined, imageCount: row.image_count ?? 0, images: (media.data ?? []).filter((asset) => asset.album_id === row.id).map((asset) => ({ id: asset.id, url: `/api/media/${asset.id}`, alt: asset.alt_text ?? row.title })), status: row.status } as AdminAlbum)),
    contacts: (contacts.data ?? []).map((row) => ({ id: row.id, name: row.name, email: row.email ?? undefined, phone: row.phone ?? undefined, message: row.message, status: row.status, createdAt: row.created_at } as AdminContact))
  };
}
