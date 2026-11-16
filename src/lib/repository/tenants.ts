import type { FamilyTree, TenantSnapshot } from "@/lib/domain/types";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTreeAccessCookie } from "@/lib/security/access-code";
import { cookies } from "next/headers";
import { sanitizeContentHtml } from "@/lib/security/sanitize-content";
import type { Person, PersonPublicFields } from "@/lib/domain/types";
import { getDemoTree } from "@/lib/demo/store";
import { isPersonalEdition } from "@/lib/personal/mode";
import { getPersonalSiteState } from "@/lib/personal/site-store";
import { toPublicPerson } from "@/lib/domain/genealogy";

type DbTenant = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  introduction: string | null;
  chronicle: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  map_url: string | null;
  published: boolean;
  locked_at: string | null;
  deletion_requested_at: string | null;
  theme: { primaryColor?: string; accentColor?: string; logoUrl?: string; bannerUrl?: string } | null;
};

function publicBodyText(value?: string | null) {
  return (value ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
}

const defaultPublicFields: PersonPublicFields = {
  avatar: false,
  exactBirthDate: false,
  phone: false,
  email: false,
  address: false,
  biography: false
};

function readPublicFields(value: unknown): PersonPublicFields {
  if (!value || typeof value !== "object") return defaultPublicFields;
  const fields = value as Record<string, unknown>;
  return {
    avatar: fields.avatar === true,
    exactBirthDate: fields.exactBirthDate === true,
    phone: fields.phone === true,
    email: fields.email === true,
    address: fields.address === true,
    biography: fields.biography === true
  };
}

function mapPublicSnapshotPerson(row: Record<string, unknown>, alreadyProjected: boolean): Person {
  const configuredFields = readPublicFields(row.public_fields);
  const canShow = (field: keyof PersonPublicFields, value: unknown) =>
    alreadyProjected ? value !== null && value !== undefined : configuredFields[field];
  const isDeceased = Boolean(row.is_deceased);

  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    treeId: String(row.tree_id),
    fullName: String(row.full_name),
    searchName: String(row.search_name),
    otherName: row.other_name ? String(row.other_name) : undefined,
    gender: row.gender as "male" | "female" | "other",
    generation: Number(row.generation),
    roleTitle: row.role_title ? String(row.role_title) : undefined,
    avatarUrl: canShow("avatar", row.avatar_url) && row.avatar_url ? String(row.avatar_url) : undefined,
    birthDate: canShow("exactBirthDate", row.birth_date) && row.birth_date ? {
      value: String(row.birth_date),
      precision: (row.birth_precision ?? "day") as "year" | "month" | "day",
      calendar: (row.birth_calendar ?? "solar") as "solar" | "lunar"
    } : undefined,
    deathDate: isDeceased && row.death_date ? {
      value: String(row.death_date),
      precision: (row.death_precision ?? "day") as "year" | "month" | "day",
      calendar: (row.death_calendar ?? "solar") as "solar" | "lunar"
    } : undefined,
    isDeceased,
    phone: canShow("phone", row.phone) && row.phone ? String(row.phone) : undefined,
    email: canShow("email", row.email) && row.email ? String(row.email) : undefined,
    address: canShow("address", row.address) && row.address ? String(row.address) : undefined,
    biography: canShow("biography", row.biography) && row.biography ? String(row.biography) : undefined,
    publicFields: alreadyProjected ? {
      avatar: row.avatar_url != null,
      exactBirthDate: row.birth_date != null,
      phone: row.phone != null,
      email: row.email != null,
      address: row.address != null,
      biography: row.biography != null
    } : configuredFields,
    sortOrder: Number(row.sort_order ?? 0)
  };
}

function projectPersonalTree(tree: FamilyTree, accessGranted: boolean): FamilyTree {
  if (!accessGranted) return { ...tree, persons: [], unions: [], parentageLinks: [] };
  const persons = tree.persons.filter((person) => !person.archivedAt).map((person) => ({
    tenantId: person.tenantId,
    treeId: person.treeId,
    searchName: person.searchName,
    otherName: person.otherName,
    publicFields: person.publicFields,
    ...toPublicPerson(person)
  } satisfies Person));
  const activeIds = new Set(persons.map((person) => person.id));
  const unions = tree.unions.filter((union) => union.partnerIds.every((id) => activeIds.has(id)));
  const unionIds = new Set(unions.map((union) => union.id));
  const parentageLinks = tree.parentageLinks.filter((link) =>
    activeIds.has(link.parentId) && activeIds.has(link.childId) && (!link.unionId || unionIds.has(link.unionId))
  );
  return { ...tree, persons, unions, parentageLinks };
}

export async function getTenantSnapshot(slug: string): Promise<TenantSnapshot | null> {
  if (isPersonalEdition() || !hasSupabaseConfig()) {
    const [site, tree] = await Promise.all([getPersonalSiteState(), getDemoTree()]);
    if (slug !== site.branding.slug || !site.branding.published) return null;
    const cookieStore = await cookies();
    const treeAccessGranted = tree.visibility === "public" || verifyTreeAccessCookie(tree.id, cookieStore.get(`tree_access_${tree.id}`)?.value);
    return {
      tenant: {
        id: site.branding.id,
        slug: site.branding.slug,
        name: site.branding.name,
        shortName: site.branding.shortName,
        introduction: site.branding.introduction,
        chronicle: site.branding.chronicle,
        address: site.branding.address,
        contactEmail: site.branding.contactEmail,
        contactPhone: site.branding.contactPhone,
        mapUrl: site.branding.mapUrl || undefined,
        seo: { title: site.branding.seoTitle, description: site.branding.seoDescription },
        published: site.branding.published,
        theme: {
          primaryColor: site.branding.primaryColor,
          accentColor: site.branding.accentColor,
          logoUrl: site.branding.logoUrl || undefined,
          bannerUrl: site.branding.bannerUrl || undefined
        }
      },
      tree: projectPersonalTree(tree, treeAccessGranted),
      subscription: { planId: "free", status: "free" },
      posts: site.posts.filter((post) => post.status === "published").map((post) => ({
        id: post.id,
        tenantId: site.branding.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        bodyText: post.bodyText,
        bodyHtml: post.bodyHtml,
        category: post.category,
        status: "published" as const,
        publishedAt: post.publishedAt
      })),
      events: site.events.filter((event) => event.status === "published").map((event) => ({
        id: event.id,
        tenantId: site.branding.id,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        lunarLabel: event.lunarLabel,
        location: event.location,
        status: "published" as const
      })),
      albums: site.albums.filter((album) => album.status === "published").map((album) => ({
        id: album.id,
        tenantId: site.branding.id,
        title: album.title,
        description: album.description,
        coverUrl: album.coverUrl,
        youtubeUrl: album.youtubeUrl,
        images: album.images,
        imageCount: album.images.length || album.imageCount,
        status: "published" as const
      })),
      treeAccessGranted
    };
  }

  const supabase = await createSupabaseServerClient();
  const queryClient = createSupabaseAdminClient() ?? supabase;
  const { data: tenantData, error: tenantError } = await queryClient
    .from("tenants")
    .select(
      "id, slug, name, short_name, introduction, chronicle, address, contact_email, contact_phone, map_url, published, locked_at, deletion_requested_at, theme"
    )
    .eq("slug", slug)
    .eq("published", true)
    .is("locked_at", null)
    .is("deletion_requested_at", null)
    .maybeSingle();

  if (tenantError) throw tenantError;
  if (!tenantData) return null;
  const tenant = tenantData as DbTenant;

  const { data: treeData, error: treeError } = await queryClient
    .from("family_trees")
    .select("id, tenant_id, name, root_person_id, visibility, graph_version")
    .eq("tenant_id", tenant.id)
    .is("archived_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (treeError) throw treeError;
  if (!treeData) return null;
  const cookieStore = await cookies();
  const treeAccessGranted = treeData.visibility === "public" || verifyTreeAccessCookie(treeData.id, cookieStore.get(`tree_access_${treeData.id}`)?.value);

  const [personsResult, unionsResult, linksResult, postsResult, eventsResult, albumsResult, mediaResult, subscriptionResult, settingsResult] =
    await Promise.all([
      treeAccessGranted
        ? treeData.visibility === "public"
          ? queryClient.from("persons_public").select("*").eq("tree_id", treeData.id)
          : queryClient.from("persons").select("*").eq("tree_id", treeData.id).is("archived_at", null)
        : Promise.resolve({ data: [], error: null }),
      treeAccessGranted ? queryClient.from("unions").select("id, tenant_id, tree_id, sort_order, union_partners(person_id)").eq("tree_id", treeData.id).is("archived_at", null) : Promise.resolve({ data: [], error: null }),
      treeAccessGranted ? queryClient.from("parentage_links").select("*").eq("tree_id", treeData.id) : Promise.resolve({ data: [], error: null }),
      queryClient.from("posts").select("*").eq("tenant_id", tenant.id).eq("status", "published").order("published_at", { ascending: false }).limit(6),
      queryClient.from("events").select("*").eq("tenant_id", tenant.id).eq("status", "published").order("starts_at").limit(6),
      queryClient.from("albums").select("*").eq("tenant_id", tenant.id).eq("status", "published").order("created_at", { ascending: false }).limit(6),
      queryClient.from("media_assets").select("id, album_id, alt_text").eq("tenant_id", tenant.id).eq("is_public", true).not("album_id", "is", null),
      queryClient.from("subscriptions").select("plan_id, status, starts_at, expires_at").eq("tenant_id", tenant.id).maybeSingle(),
      queryClient.from("tenant_settings").select("seo").eq("tenant_id", tenant.id).maybeSingle()
    ]);

  for (const result of [personsResult, unionsResult, linksResult, postsResult, eventsResult, albumsResult, mediaResult]) {
    if (result.error) throw result.error;
  }

  const theme = tenant.theme ?? {};
  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      shortName: tenant.short_name,
      introduction: tenant.introduction ?? "",
      chronicle: tenant.chronicle ?? "",
      address: tenant.address ?? "",
      contactEmail: tenant.contact_email ?? "",
      contactPhone: tenant.contact_phone ?? "",
      mapUrl: tenant.map_url ?? undefined,
      seo: (settingsResult.data?.seo ?? {}) as { title?: string; description?: string },
      published: tenant.published,
      theme: {
        primaryColor: theme.primaryColor ?? "#a83f24",
        accentColor: theme.accentColor ?? "#d59b2d",
        logoUrl: theme.logoUrl,
        bannerUrl: theme.bannerUrl
      }
    },
    tree: {
      id: treeData.id,
      tenantId: treeData.tenant_id,
      name: treeData.name,
      rootPersonId: treeData.root_person_id,
      visibility: treeData.visibility,
      graphVersion: treeData.graph_version,
      persons: (personsResult.data ?? []).map((row: Record<string, unknown>) => mapPublicSnapshotPerson(row, treeData.visibility === "public")),
      unions: (unionsResult.data ?? []).map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        treeId: row.tree_id,
        partnerIds: (row.union_partners ?? []).map((partner: { person_id: string }) => partner.person_id),
        sortOrder: row.sort_order
      })),
      parentageLinks: (linksResult.data ?? []).map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        treeId: row.tree_id,
        parentId: row.parent_id,
        childId: row.child_id,
        unionId: row.union_id ?? undefined,
        relationshipType: row.relationship_type,
        sortOrder: row.sort_order
      }))
    },
    subscription: subscriptionResult.data
      ? {
          planId: subscriptionResult.data.plan_id,
          status: subscriptionResult.data.status,
          startsAt: subscriptionResult.data.starts_at ?? undefined,
          expiresAt: subscriptionResult.data.expires_at ?? undefined
        }
      : { planId: "free", status: "free" },
    posts: (postsResult.data ?? []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt ?? "",
      bodyText: publicBodyText(row.body_html),
      bodyHtml: sanitizeContentHtml(row.body_html ?? ""),
      category: row.category ?? "Tin dòng họ",
      coverUrl: row.cover_url ?? undefined,
      youtubeUrl: row.youtube_url ?? undefined,
      images: (mediaResult.data ?? []).filter((asset) => asset.album_id === row.id).map((asset) => ({ id: asset.id, url: `/api/public/media/${asset.id}`, alt: asset.alt_text ?? row.title })),
      status: row.status,
      publishedAt: row.published_at ?? undefined
    })),
    events: (eventsResult.data ?? []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description ?? "",
      startsAt: row.starts_at,
      lunarLabel: row.lunar_label ?? undefined,
      location: row.location ?? "",
      status: row.status
    })),
    albums: (albumsResult.data ?? []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description ?? "",
      coverUrl: row.cover_url ?? undefined,
      imageCount: row.image_count ?? 0,
      status: row.status
    })),
    treeAccessGranted
  };
}
