import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeVietnameseName } from "@/lib/domain/genealogy";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { plainTextToSafeHtml, sanitizeContentHtml } from "@/lib/security/sanitize-content";
import { isPersonalEdition } from "@/lib/personal/mode";
import { createPersonalContent } from "@/lib/personal/site-store";

const status = z.enum(["draft", "published"]);
const postSchema = z.object({ kind: z.literal("post"), title: z.string().trim().min(3).max(220), excerpt: z.string().trim().max(500).default(""), bodyText: z.string().trim().max(50000).default(""), bodyHtml: z.string().max(100000).default(""), category: z.string().trim().max(100).default("Tin dòng họ"), status });
const eventSchema = z.object({ kind: z.literal("event"), title: z.string().trim().min(3).max(220), description: z.string().trim().max(10000).default(""), startsAt: z.string().datetime(), endsAt: z.string().datetime().optional(), lunarLabel: z.string().trim().max(120).default(""), location: z.string().trim().max(500).default(""), status });
const albumSchema = z.object({ kind: z.literal("album"), title: z.string().trim().min(3).max(220), description: z.string().trim().max(5000).default(""), youtubeUrl: z.union([z.literal(""), z.string().url().max(500)]).default(""), status });
const schema = z.discriminatedUnion("kind", [postSchema, eventSchema, albumSchema]);

function slugify(value: string) {
  return normalizeVietnameseName(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || crypto.randomUUID();
}

export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { tenantId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nội dung không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
  if (isPersonalEdition() || !hasSupabaseConfig()) {
    const data = parsed.data.kind === "post"
      ? {
          ...parsed.data,
          bodyHtml: parsed.data.bodyHtml ? sanitizeContentHtml(parsed.data.bodyHtml) : plainTextToSafeHtml(parsed.data.bodyText),
          bodyText: parsed.data.bodyText || parsed.data.bodyHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
        }
      : parsed.data;
    try {
      const id = await createPersonalContent(tenantId, data);
      return NextResponse.json({ id }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Không thể lưu nội dung local." }, { status: 400 });
    }
  }
  const supabase = await createSupabaseServerClient();
  const publishedAt = parsed.data.status === "published" ? new Date().toISOString() : null;
  let result;
  if (parsed.data.kind === "post") result = await supabase.from("posts").insert({ tenant_id: tenantId, title: parsed.data.title, slug: `${slugify(parsed.data.title)}-${crypto.randomUUID().slice(0, 6)}`, excerpt: parsed.data.excerpt, body_html: parsed.data.bodyHtml ? sanitizeContentHtml(parsed.data.bodyHtml) : plainTextToSafeHtml(parsed.data.bodyText), category: parsed.data.category, status: parsed.data.status, published_at: publishedAt }).select("id").single();
  else if (parsed.data.kind === "event") result = await supabase.from("events").insert({ tenant_id: tenantId, title: parsed.data.title, description: parsed.data.description, starts_at: parsed.data.startsAt, ends_at: parsed.data.endsAt ?? null, lunar_label: parsed.data.lunarLabel || null, location: parsed.data.location, status: parsed.data.status }).select("id").single();
  else result = await supabase.from("albums").insert({ tenant_id: tenantId, title: parsed.data.title, description: parsed.data.description, youtube_url: parsed.data.youtubeUrl || null, status: parsed.data.status }).select("id").single();
  if (result.error) return NextResponse.json({ error: result.error.message.includes("row-level security") ? "Dòng họ đang ở chế độ chỉ đọc." : "Không thể lưu nội dung." }, { status: result.error.message.includes("row-level security") ? 403 : 400 });
  return NextResponse.json({ id: result.data.id }, { status: 201 });
}
