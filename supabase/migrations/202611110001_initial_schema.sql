create extension if not exists pgcrypto;

create type public.tenant_role as enum ('owner', 'admin');
create type public.tree_visibility as enum ('public', 'protected');
create type public.subscription_status as enum ('free', 'pending', 'active', 'read_only', 'locked');
create type public.content_status as enum ('draft', 'published', 'archived');
create type public.date_precision as enum ('year', 'month', 'day');
create type public.calendar_type as enum ('solar', 'lunar');
create type public.relationship_type as enum ('biological', 'adoptive', 'step', 'guardian');
create type public.person_gender as enum ('male', 'female', 'other');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id text primary key,
  name text not null,
  annual_price bigint not null check (annual_price >= 0),
  member_limit integer not null check (member_limit > 0),
  admin_limit integer not null check (admin_limit > 0),
  storage_limit_bytes bigint not null check (storage_limit_bytes > 0),
  tree_limit integer not null default 5 check (tree_limit between 1 and 5),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.plans (id, name, annual_price, member_limit, admin_limit, storage_limit_bytes, tree_limit, sort_order)
values
  ('free', 'Miễn phí', 0, 50, 1, 524288000, 5, 10),
  ('basic', 'Cơ bản', 499000, 200, 3, 2147483648, 5, 20),
  ('community', 'Đoàn viên', 999000, 500, 5, 5368709120, 5, 30);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null check (char_length(name) between 2 and 160),
  short_name text not null,
  introduction text,
  chronicle text,
  address text,
  contact_email text,
  contact_phone text,
  map_url text,
  theme jsonb not null default '{"primaryColor":"#a83f24","accentColor":"#d59b2d"}'::jsonb,
  published boolean not null default false,
  locked_at timestamptz,
  deletion_requested_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.tenant_role not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  onboarding jsonb not null default '{}'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  feature_flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role public.tenant_role not null default 'admin',
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status public.subscription_status not null default 'free',
  starts_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.family_trees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  root_person_id uuid,
  visibility public.tree_visibility not null default 'protected',
  access_code_hash text,
  graph_version bigint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint protected_tree_has_code check (visibility = 'public' or access_code_hash is not null)
);

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 150),
  search_name text not null,
  other_name text,
  gender public.person_gender not null,
  role_title text,
  generation integer not null default 1 check (generation between 1 and 99),
  avatar_url text,
  biography text,
  birth_date date,
  birth_precision public.date_precision,
  birth_calendar public.calendar_type,
  death_date date,
  death_precision public.date_precision,
  death_calendar public.calendar_type,
  is_deceased boolean not null default false,
  address text,
  education text,
  religion text,
  phone text,
  email text,
  public_fields jsonb not null default '{"avatar":true,"exactBirthDate":false,"phone":false,"email":false,"address":false,"biography":false}'::jsonb,
  sort_order integer not null default 0,
  archived_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.family_trees
  add constraint family_trees_root_person_fk foreign key (root_person_id) references public.persons(id) deferrable initially deferred;

create table public.unions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  label text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.union_partners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  union_id uuid not null references public.unions(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete restrict,
  sort_order integer not null default 0,
  unique (union_id, person_id)
);

create table public.parentage_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  parent_id uuid not null references public.persons(id) on delete restrict,
  child_id uuid not null references public.persons(id) on delete restrict,
  union_id uuid references public.unions(id) on delete set null,
  relationship_type public.relationship_type not null default 'biological',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (parent_id, child_id, relationship_type),
  check (parent_id <> child_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  category text,
  slug text not null,
  title text not null,
  excerpt text,
  body_html text,
  cover_url text,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  lunar_label text,
  location text,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  youtube_url text,
  image_count integer not null default 0,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  album_id uuid references public.albums(id) on delete set null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width integer,
  height integer,
  alt_text text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'read', 'resolved')),
  created_at timestamptz not null default now()
);

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id text not null references public.plans(id),
  kind text not null check (kind in ('purchase', 'renew', 'upgrade')),
  amount bigint not null check (amount > 0),
  status public.payment_status not null default 'pending',
  payos_order_code bigint not null unique,
  payos_payment_link_id text,
  provider_reference text unique,
  webhook_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_counters (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  person_count integer not null default 0,
  admin_count integer not null default 1,
  storage_bytes bigint not null default 0,
  updated_at timestamptz not null default now(),
  check (person_count >= 0 and admin_count >= 0 and storage_bytes >= 0)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  mode text not null check (mode in ('create', 'update')),
  status text not null check (status in ('preview', 'ready', 'committed', 'failed', 'expired')),
  row_count integer not null default 0,
  warning_count integer not null default 0,
  preview_payload jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create table public.import_errors (
  id bigint generated always as identity primary key,
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  row_number integer,
  field text,
  severity text not null check (severity in ('error', 'warning')),
  code text not null,
  message text not null
);

create table public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mfa_required boolean not null default true,
  created_at timestamptz not null default now()
);

create index memberships_user_idx on public.memberships(user_id, tenant_id);
create index persons_tenant_tree_idx on public.persons(tenant_id, tree_id) where archived_at is null;
create index persons_search_idx on public.persons(tenant_id, tree_id, search_name);
create index unions_tenant_tree_idx on public.unions(tenant_id, tree_id);
create index parentage_tree_parent_idx on public.parentage_links(tenant_id, tree_id, parent_id);
create index parentage_tree_child_idx on public.parentage_links(tenant_id, tree_id, child_id);
create index posts_tenant_status_idx on public.posts(tenant_id, status, published_at desc);
create index events_tenant_status_idx on public.events(tenant_id, status, starts_at);
create index albums_tenant_status_idx on public.albums(tenant_id, status, created_at desc);
create index media_tenant_idx on public.media_assets(tenant_id, created_at desc);
create index contacts_tenant_status_idx on public.contact_messages(tenant_id, status, created_at desc);
create index audit_tenant_created_idx on public.audit_logs(tenant_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger tenants_touch before update on public.tenants for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();
create trigger trees_touch before update on public.family_trees for each row execute function public.touch_updated_at();
create trigger persons_touch before update on public.persons for each row execute function public.touch_updated_at();
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
create trigger albums_touch before update on public.albums for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payment_orders for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_tenant_owner(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins p where p.user_id = auth.uid());
$$;

create or replace function public.tenant_can_mutate(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.tenants t
    join public.subscriptions s on s.tenant_id = t.id
    where t.id = p_tenant_id
      and t.locked_at is null
      and s.status in ('free', 'active')
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

create or replace function public.validate_person_scope()
returns trigger language plpgsql as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.family_trees where id = new.tree_id;
  if v_tenant is null or v_tenant <> new.tenant_id then
    raise exception 'TREE_TENANT_MISMATCH';
  end if;
  return new;
end;
$$;
create trigger persons_validate_scope before insert or update on public.persons for each row execute function public.validate_person_scope();
create trigger unions_validate_scope before insert or update on public.unions for each row execute function public.validate_person_scope();

create or replace function public.validate_union_partner()
returns trigger language plpgsql as $$
declare v_union record; v_person record; v_count integer;
begin
  select tenant_id, tree_id into v_union from public.unions where id = new.union_id;
  select tenant_id, tree_id into v_person from public.persons where id = new.person_id and archived_at is null;
  if v_union.tenant_id is null or v_person.tenant_id is null
     or v_union.tenant_id <> v_person.tenant_id or v_union.tree_id <> v_person.tree_id
     or new.tenant_id <> v_union.tenant_id or new.tree_id <> v_union.tree_id then
    raise exception 'UNION_PARTNER_SCOPE_MISMATCH';
  end if;
  select count(*) into v_count from public.union_partners where union_id = new.union_id and id <> new.id;
  if v_count >= 2 then raise exception 'UNION_PARTNER_LIMIT'; end if;
  return new;
end;
$$;
create trigger union_partners_validate before insert or update on public.union_partners for each row execute function public.validate_union_partner();

create or replace function public.validate_parentage_link()
returns trigger language plpgsql as $$
declare v_parent record; v_child record; v_union record;
begin
  select tenant_id, tree_id into v_parent from public.persons where id = new.parent_id and archived_at is null;
  select tenant_id, tree_id into v_child from public.persons where id = new.child_id and archived_at is null;
  if v_parent.tenant_id is null or v_child.tenant_id is null
     or v_parent.tenant_id <> v_child.tenant_id or v_parent.tree_id <> v_child.tree_id
     or new.tenant_id <> v_parent.tenant_id or new.tree_id <> v_parent.tree_id then
    raise exception 'PARENTAGE_SCOPE_MISMATCH';
  end if;
  if new.union_id is not null then
    select tenant_id, tree_id into v_union from public.unions where id = new.union_id;
    if v_union.tenant_id is null or v_union.tenant_id <> new.tenant_id or v_union.tree_id <> new.tree_id then
      raise exception 'PARENTAGE_UNION_SCOPE_MISMATCH';
    end if;
  end if;
  if exists (
    with recursive descendants(id) as (
      select new.child_id
      union
      select l.child_id from public.parentage_links l join descendants d on l.parent_id = d.id
      where l.tree_id = new.tree_id and l.id <> new.id
    )
    select 1 from descendants where id = new.parent_id
  ) then
    raise exception 'GENEALOGY_CYCLE';
  end if;
  return new;
end;
$$;
create trigger parentage_validate before insert or update on public.parentage_links for each row execute function public.validate_parentage_link();

create or replace function public.reject_audit_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and new.action = old.action
     and new.entity_type = old.entity_type
     and new.entity_id is not distinct from old.entity_id
     and new.metadata = old.metadata
     and new.ip_hash is not distinct from old.ip_hash
     and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'AUDIT_LOG_IMMUTABLE';
end;
$$;
create trigger audit_immutable before update or delete on public.audit_logs for each row execute function public.reject_audit_mutation();

create or replace function public.add_person_with_version(
  p_tree_id uuid,
  p_expected_version bigint,
  p_full_name text,
  p_search_name text,
  p_gender public.person_gender,
  p_generation integer,
  p_parent_id uuid default null,
  p_relationship_type public.relationship_type default 'biological'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tree public.family_trees%rowtype; v_plan public.plans%rowtype; v_person_id uuid; v_count integer;
begin
  select * into v_tree from public.family_trees where id = p_tree_id and archived_at is null for update;
  if v_tree.id is null or not public.is_tenant_member(v_tree.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_tree.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  select p.* into v_plan from public.subscriptions s join public.plans p on p.id = s.plan_id where s.tenant_id = v_tree.tenant_id;
  select count(*) into v_count from public.persons where tenant_id = v_tree.tenant_id and archived_at is null;
  if v_count >= v_plan.member_limit then raise exception 'MEMBER_LIMIT'; end if;
  if p_parent_id is not null and not exists (
    select 1 from public.persons where id = p_parent_id and tree_id = p_tree_id and archived_at is null
  ) then raise exception 'INVALID_PARENT'; end if;

  insert into public.persons (tenant_id, tree_id, full_name, search_name, gender, generation)
  values (v_tree.tenant_id, p_tree_id, p_full_name, p_search_name, p_gender, p_generation)
  returning id into v_person_id;
  if p_parent_id is not null then
    insert into public.parentage_links (tenant_id, tree_id, parent_id, child_id, relationship_type)
    values (v_tree.tenant_id, p_tree_id, p_parent_id, v_person_id, p_relationship_type);
  end if;
  update public.family_trees set graph_version = graph_version + 1 where id = p_tree_id;
  update public.usage_counters set person_count = person_count + 1, updated_at = now() where tenant_id = v_tree.tenant_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_tree.tenant_id, auth.uid(), 'person.created', 'person', v_person_id::text);
  return jsonb_build_object('id', v_person_id, 'graphVersion', p_expected_version + 1);
end;
$$;

create or replace function public.apply_successful_payment(
  p_order_code bigint,
  p_reference text,
  p_amount bigint,
  p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.payment_orders%rowtype; v_current public.subscriptions%rowtype; v_start timestamptz; v_expiry timestamptz;
begin
  select * into v_order from public.payment_orders where payos_order_code = p_order_code for update;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'paid' then return jsonb_build_object('applied', false, 'idempotent', true); end if;
  if v_order.status <> 'pending' or v_order.amount <> p_amount then raise exception 'ORDER_MISMATCH'; end if;
  if exists (select 1 from public.payment_orders where provider_reference = p_reference and id <> v_order.id) then
    raise exception 'DUPLICATE_REFERENCE';
  end if;
  select * into v_current from public.subscriptions where tenant_id = v_order.tenant_id for update;
  v_start := now();
  if v_order.kind = 'renew' then
    v_expiry := greatest(now(), coalesce(v_current.expires_at, now())) + interval '365 days';
  else
    v_expiry := now() + interval '365 days';
  end if;
  insert into public.subscriptions (tenant_id, plan_id, status, starts_at, expires_at)
  values (v_order.tenant_id, v_order.plan_id, 'active', v_start, v_expiry)
  on conflict (tenant_id) do update set
    plan_id = excluded.plan_id, status = 'active', starts_at = excluded.starts_at,
    expires_at = excluded.expires_at, updated_at = now();
  update public.payment_orders set status = 'paid', provider_reference = p_reference,
    webhook_payload = p_payload, paid_at = now() where id = v_order.id;
  insert into public.audit_logs (tenant_id, action, entity_type, entity_id, metadata)
  values (v_order.tenant_id, 'subscription.activated', 'payment_order', v_order.id::text,
    jsonb_build_object('planId', v_order.plan_id, 'kind', v_order.kind, 'expiresAt', v_expiry));
  return jsonb_build_object('applied', true, 'expiresAt', v_expiry);
end;
$$;

create or replace view public.persons_public
with (security_barrier = true) as
select
  p.id, p.tenant_id, p.tree_id, p.full_name, p.search_name, p.other_name, p.gender,
  p.role_title, p.generation,
  case when p.is_deceased or coalesce((p.public_fields->>'avatar')::boolean, false) then p.avatar_url end as avatar_url,
  case when p.is_deceased or coalesce((p.public_fields->>'biography')::boolean, false) then p.biography end as biography,
  case when p.is_deceased or coalesce((p.public_fields->>'exactBirthDate')::boolean, false) then p.birth_date end as birth_date,
  p.birth_precision, p.birth_calendar, p.death_date, p.death_precision, p.death_calendar,
  p.is_deceased,
  case when p.is_deceased or coalesce((p.public_fields->>'address')::boolean, false) then p.address end as address,
  case when p.is_deceased or coalesce((p.public_fields->>'phone')::boolean, false) then p.phone end as phone,
  case when p.is_deceased or coalesce((p.public_fields->>'email')::boolean, false) then p.email end as email,
  p.sort_order
from public.persons p
join public.family_trees ft on ft.id = p.tree_id and ft.tenant_id = p.tenant_id
join public.tenants t on t.id = p.tenant_id
where p.archived_at is null and ft.archived_at is null and ft.visibility = 'public' and t.published and t.locked_at is null;

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.invitations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.family_trees enable row level security;
alter table public.persons enable row level security;
alter table public.unions enable row level security;
alter table public.union_partners enable row level security;
alter table public.parentage_links enable row level security;
alter table public.categories enable row level security;
alter table public.posts enable row level security;
alter table public.events enable row level security;
alter table public.albums enable row level security;
alter table public.media_assets enable row level security;
alter table public.contact_messages enable row level security;
alter table public.payment_orders enable row level security;
alter table public.usage_counters enable row level security;
alter table public.audit_logs enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_errors enable row level security;
alter table public.platform_admins enable row level security;

create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy plans_public_select on public.plans for select using (active);
create policy tenants_member_all on public.tenants for all using (public.is_tenant_member(id)) with check (public.is_tenant_member(id));
create policy tenants_public_select on public.tenants for select using (published and locked_at is null);
create policy memberships_member_select on public.memberships for select using (public.is_tenant_member(tenant_id));
create policy memberships_owner_write on public.memberships for all using (public.is_tenant_owner(tenant_id)) with check (public.is_tenant_owner(tenant_id));
create policy settings_member_all on public.tenant_settings for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy invitations_owner_all on public.invitations for all using (public.is_tenant_owner(tenant_id)) with check (public.is_tenant_owner(tenant_id));
create policy subscriptions_member_select on public.subscriptions for select using (public.is_tenant_member(tenant_id));
create policy trees_member_all on public.family_trees for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy trees_public_select on public.family_trees for select using (
  visibility = 'public' and archived_at is null and exists (select 1 from public.tenants t where t.id = tenant_id and t.published and t.locked_at is null)
);
create policy persons_member_all on public.persons for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy unions_member_all on public.unions for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy unions_public_select on public.unions for select using (exists (select 1 from public.family_trees ft join public.tenants t on t.id = ft.tenant_id where ft.id = tree_id and ft.visibility = 'public' and t.published));
create policy union_partners_member_all on public.union_partners for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy union_partners_public_select on public.union_partners for select using (exists (select 1 from public.family_trees ft join public.tenants t on t.id = ft.tenant_id where ft.id = tree_id and ft.visibility = 'public' and t.published));
create policy parentage_member_all on public.parentage_links for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy parentage_public_select on public.parentage_links for select using (exists (select 1 from public.family_trees ft join public.tenants t on t.id = ft.tenant_id where ft.id = tree_id and ft.visibility = 'public' and t.published));

create policy categories_member_all on public.categories for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy posts_member_all on public.posts for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy posts_public_select on public.posts for select using (status = 'published' and exists (select 1 from public.tenants t where t.id = tenant_id and t.published));
create policy events_member_all on public.events for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy events_public_select on public.events for select using (status = 'published' and exists (select 1 from public.tenants t where t.id = tenant_id and t.published));
create policy albums_member_all on public.albums for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy albums_public_select on public.albums for select using (status = 'published' and exists (select 1 from public.tenants t where t.id = tenant_id and t.published));
create policy media_member_all on public.media_assets for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy contacts_member_select on public.contact_messages for select using (public.is_tenant_member(tenant_id));
create policy contacts_member_update on public.contact_messages for update using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy payments_member_select on public.payment_orders for select using (public.is_tenant_member(tenant_id));
create policy usage_member_select on public.usage_counters for select using (public.is_tenant_member(tenant_id));
create policy audit_member_select on public.audit_logs for select using (public.is_tenant_member(tenant_id));
create policy imports_member_all on public.import_jobs for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy import_errors_member_select on public.import_errors for select using (exists (select 1 from public.import_jobs j where j.id = import_job_id and public.is_tenant_member(j.tenant_id)));
create policy platform_admin_self_select on public.platform_admins for select using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.plans, public.persons_public to anon, authenticated;
grant select on public.tenants, public.family_trees, public.unions, public.union_partners, public.parentage_links, public.posts, public.events, public.albums to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke update, delete on public.audit_logs from authenticated;
revoke all on function public.apply_successful_payment(bigint, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.apply_successful_payment(bigint, text, bigint, jsonb) to service_role;
grant execute on function public.add_person_with_version(uuid, bigint, text, text, public.person_gender, integer, uuid, public.relationship_type) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-media', 'tenant-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy tenant_media_public_read on storage.objects for select using (bucket_id = 'tenant-media');
create policy tenant_media_member_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'tenant-media'
  and public.is_tenant_member((storage.foldername(name))[1]::uuid)
  and public.tenant_can_mutate((storage.foldername(name))[1]::uuid)
);
create policy tenant_media_member_update on storage.objects for update to authenticated using (
  bucket_id = 'tenant-media' and public.is_tenant_member((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id = 'tenant-media' and public.is_tenant_member((storage.foldername(name))[1]::uuid)
);
create policy tenant_media_member_delete on storage.objects for delete to authenticated using (
  bucket_id = 'tenant-media' and public.is_tenant_member((storage.foldername(name))[1]::uuid)
);
