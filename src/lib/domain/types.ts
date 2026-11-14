export type TenantRole = "owner" | "admin";
export type TreeVisibility = "public" | "protected";
export type SubscriptionStatus = "free" | "pending" | "active" | "read_only" | "locked";
export type ContentStatus = "draft" | "published" | "archived";
export type DatePrecision = "year" | "month" | "day";
export type CalendarType = "solar" | "lunar";
export type RelationshipType = "biological" | "adoptive" | "step" | "guardian";
export type PersonGender = "male" | "female" | "other";

export interface GenealogyDate {
  value: string;
  precision: DatePrecision;
  calendar: CalendarType;
}

export interface TenantTheme {
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
  bannerUrl?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  introduction: string;
  chronicle: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  mapUrl?: string;
  seo?: { title?: string; description?: string };
  published: boolean;
  theme: TenantTheme;
}

export interface Plan {
  id: "free" | "basic" | "community";
  name: string;
  annualPrice: number;
  personLimit: number;
  adminLimit: number;
  storageLimitBytes: number;
  highlighted?: boolean;
}

export interface Subscription {
  planId: Plan["id"];
  status: SubscriptionStatus;
  startsAt?: string;
  expiresAt?: string;
}

export interface PersonPublicFields {
  avatar: boolean;
  exactBirthDate: boolean;
  phone: boolean;
  email: boolean;
  address: boolean;
  biography: boolean;
}

export interface Person {
  id: string;
  tenantId: string;
  treeId: string;
  fullName: string;
  searchName: string;
  otherName?: string;
  gender: PersonGender;
  generation: number;
  roleTitle?: string;
  avatarUrl?: string;
  birthDate?: GenealogyDate;
  deathDate?: GenealogyDate;
  isDeceased: boolean;
  phone?: string;
  email?: string;
  address?: string;
  education?: string;
  religion?: string;
  biography?: string;
  publicFields: PersonPublicFields;
  sortOrder: number;
  archivedAt?: string;
}

export interface FamilyUnion {
  id: string;
  tenantId: string;
  treeId: string;
  partnerIds: string[];
  sortOrder: number;
}

export interface ParentageLink {
  id: string;
  tenantId: string;
  treeId: string;
  parentId: string;
  childId: string;
  unionId?: string;
  relationshipType: RelationshipType;
  sortOrder: number;
}

export interface FamilyTree {
  id: string;
  tenantId: string;
  name: string;
  rootPersonId: string;
  visibility: TreeVisibility;
  graphVersion: number;
  persons: Person[];
  unions: FamilyUnion[];
  parentageLinks: ParentageLink[];
}

export interface Post {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyText?: string;
  bodyHtml?: string;
  category: string;
  coverUrl?: string;
  status: ContentStatus;
  publishedAt?: string;
}

export interface ClanEvent {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  startsAt: string;
  lunarLabel?: string;
  location: string;
  status: ContentStatus;
}

export interface Album {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  coverUrl?: string;
  youtubeUrl?: string;
  images?: Array<{ id: string; url: string; alt: string }>;
  imageCount: number;
  status: ContentStatus;
}

export interface TenantSnapshot {
  tenant: Tenant;
  tree: FamilyTree;
  subscription: Subscription;
  posts: Post[];
  events: ClanEvent[];
  albums: Album[];
  treeAccessGranted?: boolean;
}

export interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
  tone: "terracotta" | "gold" | "green" | "neutral";
}
