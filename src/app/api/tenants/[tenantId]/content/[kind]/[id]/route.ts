import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { sanitizeContentHtml } from "@/lib/security/sanitize-content";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const kindSchema = z.enum(["post", "event", "album"]);
const statusSchema = z.enum(["draft", "published", "archived"]);
const statusUpdate = z.object({ status: statusSchema });
const postUpdate = z.object({ title: z.string().trim().min(3).max(220), excerpt: z.string().trim().max(500).default(""), bodyHtml: z.string().max(100000).default(""), category: z.string().trim().max(100).default("Tin dòng họ"), status: z.enum(["draft", "published"]) });
const eventUpdate = z.object({ title: z.string().trim().min(3).max(220), description: z.string().trim().max(10000).default(""), startsAt: z.string().datetime(), endsAt: z.string().datetime().nullable().optional(), lunarLabel: z.string().trim().max(120).default(""), location: z.string().trim().max(500).default(""), status: z.enum(["draft", "published"]) });
const albumUpdate = z.object({ title: z.string().trim().min(3).max(220), description: z.string().trim().max(5000).default(""), youtubeUrl: z.union([z.literal(""), z.string().url().max(500)]).default(""), status: z.enum(["draft", "published"]) });

type Context = { params: Promise<{ tenantId: string; kind: string; id: string }> };

async function mutate(request: Request, context: Context, forcedStatus?: "archived") {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { tenantId, kind, id } = await context.params;
  const parsedKind = kindSchema.safeParse(kind);
  if (!parsedKind.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  const body = forcedStatus ? { status: forcedStatus } : await request.json().catch(() => null);
  const fullUpdate = !forcedStatus && body && typeof body === "object" && "title" in body;
  const parsedBody = fullUpdate
    ? parsedKind.data === "post" ? postUpdate.safeParse(body) : parsedKind.data === "event" ? eventUpdate.safeParse(body) : albumUpdate.safeParse(body)
    : statusUpdate.safeParse(body);
  if (!parsedBody.success) return NextResponse.json({ error: "Nội dung cập nhật không hợp lệ.", details: parsedBody.error.flatten() }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ updated: true, demo: true });

  const supabase = await createSupabaseServerClient();
  let error: { message: string } | null = null;
  let nextStatus: "draft" | "published" | "archived";
  if (parsedKind.data === "post") {
    const value = parsedBody.data as z.infer<typeof postUpdate> | z.infer<typeof statusUpdate>;
    nextStatus = value.status;
    const values = "title" in value
      ? { title: value.title, excerpt: value.excerpt, body_html: sanitizeContentHtml(value.bodyHtml), category: value.category, status: value.status, published_at: value.status === "published" ? new Date().toISOString() : null }
      : { status: value.status, published_at: value.status === "published" ? new Date().toISOString() : null };
    ({ error } = await supabase.from("posts").update(values).eq("id", id).eq("tenant_id", tenantId));
  } else if (parsedKind.data === "event") {
    const value = parsedBody.data as z.infer<typeof eventUpdate> | z.infer<typeof statusUpdate>;
    nextStatus = value.status;
    const values = "title" in value
      ? { title: value.title, description: value.description, starts_at: value.startsAt, ends_at: value.endsAt ?? null, lunar_label: value.lunarLabel || null, location: value.location, status: value.status }
      : { status: value.status };
    ({ error } = await supabase.from("events").update(values).eq("id", id).eq("tenant_id", tenantId));
  } else {
    const value = parsedBody.data as z.infer<typeof albumUpdate> | z.infer<typeof statusUpdate>;
    nextStatus = value.status;
    const values = "title" in value
      ? { title: value.title, description: value.description, youtube_url: value.youtubeUrl || null, status: value.status }
      : { status: value.status };
    ({ error } = await supabase.from("albums").update(values).eq("id", id).eq("tenant_id", tenantId));
  }
  if (error) return NextResponse.json({ error: "Không thể cập nhật nội dung." }, { status: 400 });
  if (parsedKind.data === "album") {
    const { error: mediaError } = await supabase.rpc("set_album_media_visibility", { p_album_id: id, p_is_public: nextStatus === "published" });
    if (mediaError) return NextResponse.json({ error: "Album đã cập nhật nhưng quyền xem ảnh chưa đồng bộ." }, { status: 500 });
  }
  return NextResponse.json({ updated: true });
}

export async function PATCH(request: Request, context: Context) { return mutate(request, context); }
export async function DELETE(request: Request, context: Context) { return mutate(request, context, "archived"); }
