import "server-only";

import { rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { demoSnapshot, demoTenant } from "@/lib/demo/data";
import { normalizeVietnameseName } from "@/lib/domain/genealogy";
import { readPersonalState, writePersonalState } from "@/lib/personal/database";
import { personalFamilySlug } from "@/lib/personal/mode";
import type { AdminAlbum, AdminContact, AdminEvent, AdminPost } from "@/lib/repository/content";
import type { TenantBranding } from "@/lib/repository/settings";
import { sanitizeContentHtml } from "@/lib/security/sanitize-content";

const PERSONAL_SITE_KEY = "family-site";

export type PersonalSiteState = {
  schemaVersion: 1;
  branding: TenantBranding;
  profile: { fullName: string; email: string };
  posts: AdminPost[];
  events: AdminEvent[];
  albums: AdminAlbum[];
  contacts: AdminContact[];
  media: PersonalMedia[];
  treeAccessHash?: string;
};

export type PersonalMedia = {
  id: string;
  filename: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  size: number;
  originalName: string;
  isPublic: boolean;
  albumId?: string;
};

const statusSchema = z.enum(["draft", "published", "archived"]);
const localMediaUrlSchema = z.string().regex(/^\/api\/personal\/media\/[0-9a-f-]{36}$/i);
const imageSchema = z.object({
  id: z.string().min(1).max(100),
  url: localMediaUrlSchema,
  alt: z.string().max(300)
}).strict();

const personalSiteSchema = z.object({
  schemaVersion: z.literal(1),
  branding: z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(2).max(160),
    shortName: z.string().min(2).max(100),
    slug: z.string().min(3).max(40),
    introduction: z.string().max(1_000),
    chronicle: z.string().max(20_000),
    address: z.string().max(500),
    contactEmail: z.union([z.literal(""), z.string().email().max(180)]),
    contactPhone: z.string().max(30),
    mapUrl: z.union([z.literal(""), z.string().url().max(1_000)]),
    published: z.boolean(),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    logoUrl: z.union([z.literal(""), localMediaUrlSchema]),
    bannerUrl: z.union([z.literal(""), localMediaUrlSchema]),
    seoTitle: z.string().max(160),
    seoDescription: z.string().max(320)
  }).strict(),
  profile: z.object({ fullName: z.string().min(2).max(150), email: z.string().max(254) }).strict(),
  posts: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(220),
    slug: z.string().min(1).max(100),
    excerpt: z.string().max(500),
    bodyText: z.string().max(50_000),
    bodyHtml: z.string().max(100_000),
    category: z.string().max(100),
    status: statusSchema,
    publishedAt: z.string().datetime().optional()
  }).strict()).max(5_000),
  events: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(220),
    description: z.string().max(10_000),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional(),
    lunarLabel: z.string().max(120).optional(),
    location: z.string().max(500),
    status: statusSchema
  }).strict()).max(5_000),
  albums: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(220),
    description: z.string().max(5_000),
    coverUrl: localMediaUrlSchema.optional(),
    youtubeUrl: z.string().url().max(500).optional(),
    imageCount: z.number().int().min(0).max(10_000),
    images: z.array(imageSchema).max(10_000),
    status: statusSchema
  }).strict()).max(2_000),
  contacts: z.array(z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(100),
    email: z.string().max(254).optional(),
    phone: z.string().max(120).optional(),
    message: z.string().min(1).max(2_000),
    status: z.enum(["unread", "read", "resolved"]),
    createdAt: z.string().datetime()
  }).strict()).max(500),
  media: z.array(z.object({
    id: z.string().uuid(),
    filename: z.string().regex(/^[0-9a-f-]{36}\.(?:jpg|png|webp|gif)$/i),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    size: z.number().int().positive().max(10 * 1024 * 1024),
    originalName: z.string().min(1).max(180),
    isPublic: z.boolean(),
    albumId: z.string().min(1).max(100).optional()
  }).strict()).max(10_000),
  treeAccessHash: z.string().max(500).optional()
}).strict();

type PersonalSiteGlobals = typeof globalThis & {
  __giaphavnPersonalSiteQueue?: Promise<void>;
};

function seedState(): PersonalSiteState {
  return {
    schemaVersion: 1,
    branding: {
      id: demoTenant.id,
      name: demoTenant.name,
      shortName: demoTenant.shortName,
      slug: personalFamilySlug(),
      introduction: demoTenant.introduction,
      chronicle: demoTenant.chronicle,
      address: demoTenant.address,
      contactEmail: demoTenant.contactEmail,
      contactPhone: demoTenant.contactPhone,
      mapUrl: demoTenant.mapUrl ?? "",
      published: demoTenant.published,
      primaryColor: demoTenant.theme.primaryColor,
      accentColor: demoTenant.theme.accentColor,
      logoUrl: demoTenant.theme.logoUrl ?? "",
      bannerUrl: demoTenant.theme.bannerUrl ?? "",
      seoTitle: demoTenant.seo?.title ?? demoTenant.name,
      seoDescription: demoTenant.seo?.description ?? demoTenant.introduction
    },
    profile: { fullName: "Quản trị gia phả", email: "" },
    posts: demoSnapshot.posts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      bodyText: post.bodyText ?? post.excerpt,
      bodyHtml: post.bodyHtml ?? `<p>${post.excerpt}</p>`,
      category: post.category,
      status: post.status,
      publishedAt: post.publishedAt
    })),
    events: demoSnapshot.events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      lunarLabel: event.lunarLabel,
      location: event.location,
      status: event.status
    })),
    albums: demoSnapshot.albums.map((album) => ({
      id: album.id,
      title: album.title,
      description: album.description,
      coverUrl: album.coverUrl,
      youtubeUrl: album.youtubeUrl,
      imageCount: album.imageCount,
      images: album.images ?? [],
      status: album.status
    })),
    contacts: [],
    media: []
  };
}

function readState() {
  const stored = readPersonalState(PERSONAL_SITE_KEY);
  if (!stored) {
    const initial = seedState();
    writePersonalState(PERSONAL_SITE_KEY, JSON.stringify(initial));
    return initial;
  }
  const raw: unknown = JSON.parse(stored);
  if (raw && typeof raw === "object" && !("media" in raw)) (raw as Record<string, unknown>).media = [];
  const parsed = personalSiteSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Định dạng dữ liệu website cá nhân không hợp lệ.");
  return parsed.data as PersonalSiteState;
}

function writeState(state: PersonalSiteState) {
  writePersonalState(PERSONAL_SITE_KEY, JSON.stringify(state));
}

function runExclusive<T>(task: () => Promise<T> | T): Promise<T> {
  const globals = globalThis as PersonalSiteGlobals;
  const previous = globals.__giaphavnPersonalSiteQueue ?? Promise.resolve();
  const running = previous.catch(() => undefined).then(task);
  globals.__giaphavnPersonalSiteQueue = running.then(() => undefined, () => undefined);
  return running;
}

function requireTenant(state: PersonalSiteState, tenantId: string) {
  if (state.branding.id !== tenantId) throw new Error("PERSONAL_TENANT_NOT_FOUND");
}

export function getPersonalSiteState() {
  return runExclusive(() => structuredClone(readState()));
}

export function resetPersonalSiteData() {
  return runExclusive(async () => {
    const state = seedState();
    writeState(state);
    await rm(path.join(process.cwd(), ".data", "media"), { recursive: true, force: true });
    return structuredClone(state);
  });
}

export function restorePersonalSiteState(input: unknown) {
  if (input && typeof input === "object" && !("media" in input)) (input as Record<string, unknown>).media = [];
  const parsed = personalSiteSchema.safeParse(input);
  if (!parsed.success || parsed.data.branding.id !== demoTenant.id || parsed.data.branding.slug !== personalFamilySlug()) {
    throw new Error("PERSONAL_SITE_BACKUP_INVALID");
  }
  return runExclusive(() => {
    const state = structuredClone(parsed.data) as PersonalSiteState;
    state.posts.forEach((post) => { post.bodyHtml = sanitizeContentHtml(post.bodyHtml); });
    writeState(state);
    return structuredClone(state);
  });
}

export function updatePersonalProfile(fullName: string) {
  return runExclusive(() => {
    const state = readState();
    state.profile.fullName = fullName;
    writeState(state);
    return structuredClone(state.profile);
  });
}

export function getPersonalTreeAccessHash() {
  return runExclusive(() => readState().treeAccessHash);
}

export function setPersonalTreeAccessHash(value: string) {
  return runExclusive(() => {
    const state = readState();
    state.treeAccessHash = value;
    writeState(state);
  });
}

export function updatePersonalBranding(tenantId: string, branding: Omit<TenantBranding, "id" | "slug">) {
  return runExclusive(() => {
    const state = readState();
    requireTenant(state, tenantId);
    state.branding = { ...state.branding, ...branding };
    writeState(state);
    return structuredClone(state.branding);
  });
}

type NewContent =
  | { kind: "post"; title: string; excerpt: string; bodyHtml: string; bodyText: string; category: string; status: "draft" | "published" }
  | { kind: "event"; title: string; description: string; startsAt: string; endsAt?: string; lunarLabel: string; location: string; status: "draft" | "published" }
  | { kind: "album"; title: string; description: string; youtubeUrl: string; status: "draft" | "published" };

export function createPersonalContent(tenantId: string, input: NewContent) {
  return runExclusive(() => {
    const state = readState();
    requireTenant(state, tenantId);
    const id = crypto.randomUUID();
    if (input.kind === "post") {
      const slugBase = normalizeVietnameseName(input.title).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "bai-viet";
      state.posts.unshift({
        id,
        title: input.title,
        slug: `${slugBase}-${id.slice(0, 6)}`,
        excerpt: input.excerpt,
        bodyHtml: sanitizeContentHtml(input.bodyHtml),
        bodyText: input.bodyText,
        category: input.category,
        status: input.status,
        publishedAt: input.status === "published" ? new Date().toISOString() : undefined
      });
    } else if (input.kind === "event") {
      state.events.unshift({
        id,
        title: input.title,
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        lunarLabel: input.lunarLabel || undefined,
        location: input.location,
        status: input.status
      });
    } else {
      state.albums.unshift({ id, title: input.title, description: input.description, youtubeUrl: input.youtubeUrl || undefined, imageCount: 0, images: [], status: input.status });
    }
    writeState(state);
    return id;
  });
}

export function updatePersonalContent(
  tenantId: string,
  kind: "post" | "event" | "album",
  id: string,
  values: Record<string, unknown>
) {
  return runExclusive(() => {
    const state = readState();
    requireTenant(state, tenantId);
    const collection = kind === "post" ? state.posts : kind === "event" ? state.events : state.albums;
    const item = collection.find((entry) => entry.id === id) as Record<string, unknown> | undefined;
    if (!item) throw new Error("PERSONAL_CONTENT_NOT_FOUND");
    Object.assign(item, values);
    if (kind === "post" && typeof item.bodyHtml === "string") item.bodyHtml = sanitizeContentHtml(item.bodyHtml);
    if (kind === "post" && values.status === "published" && !item.publishedAt) item.publishedAt = new Date().toISOString();
    if (kind === "post" && values.status !== "published") item.publishedAt = undefined;
    writeState(state);
  });
}

export function addPersonalContact(tenantId: string, input: { name: string; contact: string; message: string }) {
  return runExclusive(() => {
    const state = readState();
    requireTenant(state, tenantId);
    state.contacts.unshift({
      id: crypto.randomUUID(),
      name: input.name,
      email: input.contact.includes("@") ? input.contact : undefined,
      phone: input.contact.includes("@") ? undefined : input.contact,
      message: input.message,
      status: "unread",
      createdAt: new Date().toISOString()
    });
    state.contacts = state.contacts.slice(0, 500);
    writeState(state);
  });
}

export function updatePersonalContact(tenantId: string, id: string, status: AdminContact["status"]) {
  return runExclusive(() => {
    const state = readState();
    requireTenant(state, tenantId);
    const contact = state.contacts.find((entry) => entry.id === id);
    if (!contact) throw new Error("PERSONAL_CONTACT_NOT_FOUND");
    contact.status = status;
    writeState(state);
  });
}

export function addPersonalMedia(
  tenantId: string,
  media: PersonalMedia,
  options: { albumId?: string; alt?: string } = {}
) {
  return runExclusive(() => {
    const state = readState();
    requireTenant(state, tenantId);
    if (state.media.some((entry) => entry.id === media.id)) throw new Error("PERSONAL_MEDIA_EXISTS");
    if (options.albumId) {
      const album = state.albums.find((entry) => entry.id === options.albumId && entry.status !== "archived");
      if (!album) throw new Error("PERSONAL_ALBUM_NOT_FOUND");
      album.images.push({ id: media.id, url: `/api/personal/media/${media.id}`, alt: options.alt || album.title });
      album.imageCount = album.images.length;
      album.coverUrl ??= `/api/personal/media/${media.id}`;
    }
    state.media.push(media);
    writeState(state);
  });
}

export function getPersonalMedia(id: string) {
  return runExclusive(() => {
    const media = readState().media.find((entry) => entry.id === id);
    return media ? structuredClone(media) : undefined;
  });
}

export function removePersonalMedia(id: string) {
  return runExclusive(() => {
    const state = readState();
    const media = state.media.find((entry) => entry.id === id);
    if (!media) throw new Error("PERSONAL_MEDIA_NOT_FOUND");
    state.media = state.media.filter((entry) => entry.id !== id);
    for (const album of state.albums) {
      album.images = album.images.filter((image) => image.id !== id);
      album.imageCount = album.images.length;
      if (album.coverUrl === `/api/personal/media/${id}`) album.coverUrl = album.images[0]?.url;
    }
    if (state.branding.logoUrl === `/api/personal/media/${id}`) state.branding.logoUrl = "";
    if (state.branding.bannerUrl === `/api/personal/media/${id}`) state.branding.bannerUrl = "";
    writeState(state);
    return structuredClone(media);
  });
}
