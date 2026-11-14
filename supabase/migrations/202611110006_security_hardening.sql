-- Security hardening for pilot data. This migration intentionally replaces the
-- broad "member_all" policies from the initial prototype with explicit read
-- and write policies. Genealogy writes stay RPC-only so graph_version, limits,
-- cycle detection and audit logging cannot be bypassed with direct table calls.

drop policy if exists tenants_member_all on public.tenants;
drop policy if exists tenants_public_select on public.tenants;
drop policy if exists memberships_member_select on public.memberships;
drop policy if exists memberships_owner_write on public.memberships;
drop policy if exists settings_member_all on public.tenant_settings;
drop policy if exists invitations_owner_all on public.invitations;
drop policy if exists subscriptions_member_select on public.subscriptions;
drop policy if exists trees_member_all on public.family_trees;
drop policy if exists trees_public_select on public.family_trees;
drop policy if exists persons_member_all on public.persons;
drop policy if exists unions_member_all on public.unions;
drop policy if exists unions_public_select on public.unions;
drop policy if exists union_partners_member_all on public.union_partners;
drop policy if exists union_partners_public_select on public.union_partners;
drop policy if exists parentage_member_all on public.parentage_links;
drop policy if exists parentage_public_select on public.parentage_links;
drop policy if exists categories_member_all on public.categories;
drop policy if exists posts_member_all on public.posts;
drop policy if exists posts_public_select on public.posts;
drop policy if exists events_member_all on public.events;
drop policy if exists events_public_select on public.events;
drop policy if exists albums_member_all on public.albums;
drop policy if exists albums_public_select on public.albums;
drop policy if exists media_member_all on public.media_assets;
drop policy if exists contacts_member_select on public.contact_messages;
drop policy if exists contacts_member_update on public.contact_messages;
drop policy if exists payments_member_select on public.payment_orders;
drop policy if exists usage_member_select on public.usage_counters;
drop policy if exists audit_member_select on public.audit_logs;
drop policy if exists imports_member_all on public.import_jobs;
drop policy if exists import_errors_member_select on public.import_errors;

create policy tenants_member_select on public.tenants for select
  using (public.is_tenant_member(id));
create policy tenants_public_select on public.tenants for select
  using (published and locked_at is null and deletion_requested_at is null);
-- Tenant mutations are RPC-only so slug, owner and lifecycle fields cannot be
-- changed by submitting extra columns through PostgREST.

create policy memberships_member_select on public.memberships for select
  using (public.is_tenant_member(tenant_id));
-- Membership writes are RPC-only so owner count and plan limits cannot be
-- bypassed with a direct PostgREST mutation.

create policy settings_member_select on public.tenant_settings for select
  using (public.is_tenant_member(tenant_id));
create policy settings_member_insert on public.tenant_settings for insert
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy settings_member_update on public.tenant_settings for update
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id))
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));

create policy invitations_owner_select on public.invitations for select
  using (public.is_tenant_owner(tenant_id));

create policy subscriptions_member_select on public.subscriptions for select
  using (public.is_tenant_member(tenant_id));

create policy trees_member_select on public.family_trees for select
  using (public.is_tenant_member(tenant_id));
create policy trees_public_select on public.family_trees for select using (
  visibility = 'public'
  and archived_at is null
  and exists (
    select 1 from public.tenants t
    where t.id = tenant_id and t.published and t.locked_at is null and t.deletion_requested_at is null
  )
);

create policy persons_member_select on public.persons for select
  using (public.is_tenant_member(tenant_id));
create policy unions_member_select on public.unions for select
  using (public.is_tenant_member(tenant_id));
create policy union_partners_member_select on public.union_partners for select
  using (public.is_tenant_member(tenant_id));
create policy parentage_member_select on public.parentage_links for select
  using (public.is_tenant_member(tenant_id));

create policy unions_public_select on public.unions for select using (exists (
  select 1 from public.family_trees ft
  join public.tenants t on t.id = ft.tenant_id
  where ft.id = tree_id and ft.visibility = 'public' and ft.archived_at is null
    and t.published and t.locked_at is null and t.deletion_requested_at is null
));
create policy union_partners_public_select on public.union_partners for select using (exists (
  select 1 from public.family_trees ft
  join public.tenants t on t.id = ft.tenant_id
  where ft.id = tree_id and ft.visibility = 'public' and ft.archived_at is null
    and t.published and t.locked_at is null and t.deletion_requested_at is null
));
create policy parentage_public_select on public.parentage_links for select using (exists (
  select 1 from public.family_trees ft
  join public.tenants t on t.id = ft.tenant_id
  where ft.id = tree_id and ft.visibility = 'public' and ft.archived_at is null
    and t.published and t.locked_at is null and t.deletion_requested_at is null
));

create policy categories_member_select on public.categories for select
  using (public.is_tenant_member(tenant_id));
create policy categories_member_insert on public.categories for insert
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy categories_member_update on public.categories for update
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id))
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy categories_member_delete on public.categories for delete
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));

create policy posts_member_select on public.posts for select
  using (public.is_tenant_member(tenant_id));
create policy posts_member_insert on public.posts for insert
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy posts_member_update on public.posts for update
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id))
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy posts_member_delete on public.posts for delete
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy posts_public_select on public.posts for select using (
  status = 'published' and exists (
    select 1 from public.tenants t
    where t.id = tenant_id and t.published and t.locked_at is null and t.deletion_requested_at is null
  )
);

create policy events_member_select on public.events for select
  using (public.is_tenant_member(tenant_id));
create policy events_member_insert on public.events for insert
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy events_member_update on public.events for update
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id))
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy events_member_delete on public.events for delete
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy events_public_select on public.events for select using (
  status = 'published' and exists (
    select 1 from public.tenants t
    where t.id = tenant_id and t.published and t.locked_at is null and t.deletion_requested_at is null
  )
);

create policy albums_member_select on public.albums for select
  using (public.is_tenant_member(tenant_id));
create policy albums_member_insert on public.albums for insert
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy albums_member_update on public.albums for update
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id))
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy albums_member_delete on public.albums for delete
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy albums_public_select on public.albums for select using (
  status = 'published' and exists (
    select 1 from public.tenants t
    where t.id = tenant_id and t.published and t.locked_at is null and t.deletion_requested_at is null
  )
);

alter table public.media_assets add column if not exists is_public boolean not null default false;
alter table public.payment_orders add column if not exists expires_at timestamptz;
alter table public.payment_orders add column if not exists provider_status text;
alter table public.payment_orders add column if not exists last_reconciled_at timestamptz;
create policy media_member_select on public.media_assets for select
  using (public.is_tenant_member(tenant_id));
create policy media_member_insert on public.media_assets for insert
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy media_member_update on public.media_assets for update
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id))
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy media_member_delete on public.media_assets for delete
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));
create policy media_public_select on public.media_assets for select using (
  is_public and exists (
    select 1 from public.tenants t
    where t.id = tenant_id and t.published and t.locked_at is null and t.deletion_requested_at is null
  )
);

create policy contacts_member_select on public.contact_messages for select
  using (public.is_tenant_member(tenant_id));
create policy contacts_member_update on public.contact_messages for update
  using (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id))
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id));

create policy payments_member_select on public.payment_orders for select
  using (public.is_tenant_member(tenant_id));
create policy usage_member_select on public.usage_counters for select
  using (public.is_tenant_member(tenant_id));
create policy audit_member_select on public.audit_logs for select
  using (public.is_tenant_member(tenant_id));

create policy imports_member_select on public.import_jobs for select
  using (public.is_tenant_member(tenant_id));
create policy imports_member_insert on public.import_jobs for insert
  with check (public.is_tenant_member(tenant_id) and public.tenant_can_mutate(tenant_id) and created_by = auth.uid());
create policy import_errors_member_select on public.import_errors for select using (exists (
  select 1 from public.import_jobs j
  where j.id = import_job_id and public.is_tenant_member(j.tenant_id)
));

-- Private by default. Public pages use the audited media endpoint and signed
-- URLs instead of exposing every tenant object by path.
update storage.buckets set public = false where id = 'tenant-media';
drop policy if exists tenant_media_public_read on storage.objects;
drop policy if exists tenant_media_member_update on storage.objects;
drop policy if exists tenant_media_member_delete on storage.objects;
create policy tenant_media_member_select on storage.objects for select to authenticated using (
  bucket_id = 'tenant-media' and public.is_tenant_member((storage.foldername(name))[1]::uuid)
);
create policy tenant_media_member_update on storage.objects for update to authenticated using (
  bucket_id = 'tenant-media'
  and public.is_tenant_member((storage.foldername(name))[1]::uuid)
  and public.tenant_can_mutate((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id = 'tenant-media'
  and public.is_tenant_member((storage.foldername(name))[1]::uuid)
  and public.tenant_can_mutate((storage.foldername(name))[1]::uuid)
);
create policy tenant_media_member_delete on storage.objects for delete to authenticated using (
  bucket_id = 'tenant-media'
  and public.is_tenant_member((storage.foldername(name))[1]::uuid)
  and public.tenant_can_mutate((storage.foldername(name))[1]::uuid)
);

-- Distributed fixed-window limiter. Callers submit an HMAC, never a raw IP.
create table if not exists public.rate_limit_buckets (
  key_hash text primary key,
  request_count integer not null check (request_count > 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated;

create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_bucket public.rate_limit_buckets%rowtype; v_now timestamptz := clock_timestamp();
begin
  if char_length(p_key_hash) <> 64 or p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;

  insert into public.rate_limit_buckets (key_hash, request_count, reset_at, updated_at)
  values (p_key_hash, 1, v_now + make_interval(secs => p_window_seconds), v_now)
  on conflict (key_hash) do update set
    request_count = case
      when public.rate_limit_buckets.reset_at <= v_now then 1
      else public.rate_limit_buckets.request_count + 1
    end,
    reset_at = case
      when public.rate_limit_buckets.reset_at <= v_now then v_now + make_interval(secs => p_window_seconds)
      else public.rate_limit_buckets.reset_at
    end,
    updated_at = v_now
  returning * into v_bucket;

  return jsonb_build_object(
    'allowed', v_bucket.request_count <= p_limit,
    'remaining', greatest(0, p_limit - v_bucket.request_count),
    'retryAfter', greatest(0, ceil(extract(epoch from (v_bucket.reset_at - v_now)))::integer)
  );
end;
$$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create or replace function public.cleanup_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_imports integer; v_rate_limits integer; v_people integer;
begin
  update public.import_jobs set status = 'expired', preview_payload = null
  where status in ('preview', 'ready') and expires_at <= now();
  get diagnostics v_imports = row_count;

  delete from public.rate_limit_buckets where reset_at < now() - interval '1 day';
  get diagnostics v_rate_limits = row_count;

  delete from public.parentage_links l
  where exists (
    select 1 from public.persons p
    where (p.id = l.parent_id or p.id = l.child_id)
      and p.archived_at is not null and p.purge_after <= now()
  );
  delete from public.unions u
  where exists (
    select 1 from public.union_partners up
    join public.persons p on p.id = up.person_id
    where up.union_id = u.id and p.archived_at is not null and p.purge_after <= now()
  );
  delete from public.persons p
  where p.archived_at is not null and p.purge_after is not null and p.purge_after <= now();
  get diagnostics v_people = row_count;

  return jsonb_build_object('importsExpired', v_imports, 'rateLimitsDeleted', v_rate_limits, 'peoplePurged', v_people);
end;
$$;
revoke all on function public.cleanup_operational_data() from public, anon, authenticated;
grant execute on function public.cleanup_operational_data() to service_role;

create or replace function public.set_media_asset_visibility(p_asset_id uuid, p_is_public boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_asset public.media_assets%rowtype;
begin
  select * into v_asset from public.media_assets where id = p_asset_id for update;
  if v_asset.id is null or not public.is_tenant_member(v_asset.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_asset.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  update public.media_assets set is_public = p_is_public where id = p_asset_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_asset.tenant_id,
    auth.uid(),
    'media.visibility_changed',
    'media_asset',
    p_asset_id::text,
    jsonb_build_object('isPublic', p_is_public)
  );
  return true;
end;
$$;
revoke all on function public.set_media_asset_visibility(uuid, boolean) from public, anon;
grant execute on function public.set_media_asset_visibility(uuid, boolean) to authenticated;

create or replace function public.request_tenant_deletion(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_tenant public.tenants%rowtype;
begin
  select * into v_tenant from public.tenants where id = p_tenant_id for update;
  if v_tenant.id is null or not public.is_tenant_owner(v_tenant.id) then raise exception 'FORBIDDEN'; end if;
  if v_tenant.deletion_requested_at is null then
    update public.tenants set
      published = false,
      deletion_requested_at = now(),
      purge_after = now() + interval '30 days',
      updated_at = now()
    where id = v_tenant.id;
    insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (v_tenant.id, auth.uid(), 'tenant.deletion_requested', 'tenant', v_tenant.id::text, jsonb_build_object('purgeAfter', now() + interval '30 days'));
  end if;
  return jsonb_build_object('requested', true, 'purgeAfter', coalesce(v_tenant.purge_after, now() + interval '30 days'));
end;
$$;

create or replace function public.cancel_tenant_deletion(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_tenant public.tenants%rowtype;
begin
  select * into v_tenant from public.tenants where id = p_tenant_id for update;
  if v_tenant.id is null or not public.is_tenant_owner(v_tenant.id) then raise exception 'FORBIDDEN'; end if;
  if v_tenant.purge_after is not null and v_tenant.purge_after <= now() then raise exception 'PURGE_STARTED'; end if;
  update public.tenants set deletion_requested_at = null, purge_after = null, updated_at = now() where id = v_tenant.id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_tenant.id, auth.uid(), 'tenant.deletion_cancelled', 'tenant', v_tenant.id::text);
  return jsonb_build_object('cancelled', true);
end;
$$;

revoke all on function public.request_tenant_deletion(uuid) from public, anon;
revoke all on function public.cancel_tenant_deletion(uuid) from public, anon;
grant execute on function public.request_tenant_deletion(uuid) to authenticated;
grant execute on function public.cancel_tenant_deletion(uuid) to authenticated;

create or replace function public.create_family_tree(
  p_tenant_id uuid,
  p_name text,
  p_root_name text,
  p_root_search_name text,
  p_root_gender public.person_gender
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_tree_id uuid; v_root_id uuid; v_tree_count integer; v_usage public.usage_counters%rowtype; v_limit integer;
begin
  if not public.is_tenant_member(p_tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(p_tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if char_length(btrim(p_name)) not between 2 and 120 or char_length(btrim(p_root_name)) not between 2 and 150 then raise exception 'INVALID_INPUT'; end if;
  select count(*) into v_tree_count from public.family_trees where tenant_id = p_tenant_id and archived_at is null;
  if v_tree_count >= 5 then raise exception 'TREE_LIMIT'; end if;
  select * into v_usage from public.usage_counters where tenant_id = p_tenant_id for update;
  select p.member_limit into v_limit from public.subscriptions s join public.plans p on p.id = s.plan_id where s.tenant_id = p_tenant_id;
  if v_usage.person_count >= v_limit then raise exception 'MEMBER_LIMIT'; end if;

  insert into public.family_trees (tenant_id, name, visibility, graph_version)
  values (p_tenant_id, btrim(p_name), 'public', 1) returning id into v_tree_id;
  insert into public.persons (tenant_id, tree_id, full_name, search_name, gender, generation, role_title)
  values (p_tenant_id, v_tree_id, btrim(p_root_name), p_root_search_name, p_root_gender, 1, 'Thành viên gốc') returning id into v_root_id;
  update public.family_trees set root_person_id = v_root_id where id = v_tree_id;
  update public.usage_counters set person_count = person_count + 1, updated_at = now() where tenant_id = p_tenant_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (p_tenant_id, auth.uid(), 'tree.created', 'family_tree', v_tree_id::text);
  return jsonb_build_object('treeId', v_tree_id, 'rootPersonId', v_root_id, 'graphVersion', 1);
end;
$$;

create or replace function public.update_family_tree_settings(
  p_tree_id uuid,
  p_expected_version bigint,
  p_name text,
  p_root_person_id uuid,
  p_visibility public.tree_visibility,
  p_access_code_hash text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_tree public.family_trees%rowtype; v_hash text;
begin
  select * into v_tree from public.family_trees where id = p_tree_id and archived_at is null for update;
  if v_tree.id is null or not public.is_tenant_member(v_tree.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_tree.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if char_length(btrim(p_name)) not between 2 and 120 then raise exception 'INVALID_INPUT'; end if;
  if not exists (select 1 from public.persons where id = p_root_person_id and tree_id = p_tree_id and archived_at is null) then raise exception 'INVALID_ROOT'; end if;
  v_hash := coalesce(nullif(p_access_code_hash, ''), v_tree.access_code_hash);
  if p_visibility = 'protected' and v_hash is null then raise exception 'ACCESS_CODE_REQUIRED'; end if;

  update public.family_trees set
    name = btrim(p_name),
    root_person_id = p_root_person_id,
    visibility = p_visibility,
    access_code_hash = case when p_visibility = 'protected' then v_hash else null end,
    graph_version = graph_version + 1,
    updated_at = now()
  where id = p_tree_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_tree.tenant_id, auth.uid(), 'tree.settings_updated', 'family_tree', p_tree_id::text, jsonb_build_object('visibility', p_visibility, 'rootPersonId', p_root_person_id));
  return jsonb_build_object('updated', true, 'graphVersion', p_expected_version + 1);
end;
$$;

create or replace function public.archive_family_tree(p_tree_id uuid, p_expected_version bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_tree public.family_trees%rowtype; v_count integer;
begin
  select * into v_tree from public.family_trees where id = p_tree_id and archived_at is null for update;
  if v_tree.id is null or not public.is_tenant_member(v_tree.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_tree.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  select count(*) into v_count from public.family_trees where tenant_id = v_tree.tenant_id and archived_at is null;
  if v_count <= 1 then raise exception 'LAST_TREE'; end if;
  update public.family_trees set archived_at = now(), updated_at = now(), graph_version = graph_version + 1 where id = p_tree_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_tree.tenant_id, auth.uid(), 'tree.archived', 'family_tree', p_tree_id::text);
  return jsonb_build_object('archived', true);
end;
$$;

revoke all on function public.create_family_tree(uuid, text, text, text, public.person_gender) from public, anon;
revoke all on function public.update_family_tree_settings(uuid, bigint, text, uuid, public.tree_visibility, text) from public, anon;
revoke all on function public.archive_family_tree(uuid, bigint) from public, anon;
grant execute on function public.create_family_tree(uuid, text, text, text, public.person_gender) to authenticated;
grant execute on function public.update_family_tree_settings(uuid, bigint, text, uuid, public.tree_visibility, text) to authenticated;
grant execute on function public.archive_family_tree(uuid, bigint) to authenticated;

create or replace function public.add_related_person_with_version(
  p_tree_id uuid,
  p_expected_version bigint,
  p_anchor_id uuid,
  p_relation text,
  p_full_name text,
  p_search_name text,
  p_gender public.person_gender,
  p_relationship_type public.relationship_type default 'biological'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tree public.family_trees%rowtype; v_anchor public.persons%rowtype; v_plan public.plans%rowtype;
  v_person_id uuid; v_union_id uuid; v_count integer; v_generation integer; v_rebased boolean := false;
begin
  select * into v_tree from public.family_trees where id = p_tree_id and archived_at is null for update;
  if v_tree.id is null or not public.is_tenant_member(v_tree.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_tree.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  select * into v_anchor from public.persons where id = p_anchor_id and tree_id = p_tree_id and archived_at is null;
  if v_anchor.id is null then raise exception 'INVALID_ANCHOR'; end if;
  if p_relation not in ('parent', 'spouse', 'child') then raise exception 'INVALID_RELATION'; end if;
  if char_length(btrim(p_full_name)) not between 2 and 150 then raise exception 'INVALID_INPUT'; end if;
  select p.* into v_plan from public.subscriptions s join public.plans p on p.id = s.plan_id where s.tenant_id = v_tree.tenant_id;
  select count(*) into v_count from public.persons where tenant_id = v_tree.tenant_id and archived_at is null;
  if v_count >= v_plan.member_limit then raise exception 'MEMBER_LIMIT'; end if;

  if p_relation = 'parent' and v_anchor.generation = 1 then
    if exists (select 1 from public.persons where tree_id = p_tree_id and archived_at is null and generation >= 99) then raise exception 'GENERATION_LIMIT'; end if;
    update public.persons set generation = generation + 1 where tree_id = p_tree_id and archived_at is null;
    v_generation := 1;
    v_rebased := true;
  elsif p_relation = 'parent' then
    v_generation := v_anchor.generation - 1;
  elsif p_relation = 'child' then
    if v_anchor.generation >= 99 then raise exception 'GENERATION_LIMIT'; end if;
    v_generation := v_anchor.generation + 1;
  else
    v_generation := v_anchor.generation;
  end if;

  insert into public.persons (tenant_id, tree_id, full_name, search_name, gender, generation)
  values (v_tree.tenant_id, p_tree_id, btrim(p_full_name), p_search_name, p_gender, v_generation)
  returning id into v_person_id;

  if p_relation = 'child' then
    insert into public.parentage_links (tenant_id, tree_id, parent_id, child_id, relationship_type)
    values (v_tree.tenant_id, p_tree_id, p_anchor_id, v_person_id, p_relationship_type);
  elsif p_relation = 'parent' then
    insert into public.parentage_links (tenant_id, tree_id, parent_id, child_id, relationship_type)
    values (v_tree.tenant_id, p_tree_id, v_person_id, p_anchor_id, p_relationship_type);
  else
    insert into public.unions (tenant_id, tree_id) values (v_tree.tenant_id, p_tree_id) returning id into v_union_id;
    insert into public.union_partners (tenant_id, tree_id, union_id, person_id, sort_order) values
      (v_tree.tenant_id, p_tree_id, v_union_id, p_anchor_id, 0),
      (v_tree.tenant_id, p_tree_id, v_union_id, v_person_id, 1);
  end if;

  update public.family_trees set graph_version = graph_version + 1, updated_at = now() where id = p_tree_id;
  update public.usage_counters set person_count = person_count + 1, updated_at = now() where tenant_id = v_tree.tenant_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_tree.tenant_id, auth.uid(), 'person.created', 'person', v_person_id::text, jsonb_build_object('relation', p_relation, 'anchorId', p_anchor_id));
  return jsonb_build_object('id', v_person_id, 'unionId', v_union_id, 'generation', v_generation, 'rebased', v_rebased, 'graphVersion', p_expected_version + 1);
end;
$$;

create or replace function public.update_person_with_version(
  p_person_id uuid,
  p_expected_version bigint,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_person public.persons%rowtype; v_tree public.family_trees%rowtype; v_birth_precision public.date_precision; v_death_precision public.date_precision;
begin
  select * into v_person from public.persons where id = p_person_id and archived_at is null for update;
  if v_person.id is null or not public.is_tenant_member(v_person.tenant_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_tree from public.family_trees where id = v_person.tree_id and archived_at is null for update;
  if not public.tenant_can_mutate(v_person.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if char_length(btrim(p_payload->>'fullName')) not between 2 and 150 then raise exception 'INVALID_INPUT'; end if;
  v_birth_precision := coalesce((nullif(p_payload->>'birthPrecision', ''))::public.date_precision, 'day');
  v_death_precision := coalesce((nullif(p_payload->>'deathPrecision', ''))::public.date_precision, 'day');

  update public.persons set
    full_name = btrim(p_payload->>'fullName'),
    search_name = p_payload->>'searchName',
    other_name = nullif(p_payload->>'otherName', ''),
    gender = (p_payload->>'gender')::public.person_gender,
    role_title = nullif(p_payload->>'roleTitle', ''),
    avatar_url = nullif(p_payload->>'avatarUrl', ''),
    generation = (p_payload->>'generation')::integer,
    biography = nullif(p_payload->>'biography', ''),
    birth_date = public.parse_partial_date(nullif(p_payload->>'birthValue', ''), v_birth_precision),
    birth_precision = case when nullif(p_payload->>'birthValue', '') is null then null else v_birth_precision end,
    birth_calendar = coalesce((nullif(p_payload->>'birthCalendar', ''))::public.calendar_type, 'solar'),
    death_date = public.parse_partial_date(nullif(p_payload->>'deathValue', ''), v_death_precision),
    death_precision = case when nullif(p_payload->>'deathValue', '') is null then null else v_death_precision end,
    death_calendar = coalesce((nullif(p_payload->>'deathCalendar', ''))::public.calendar_type, 'solar'),
    is_deceased = coalesce((p_payload->>'isDeceased')::boolean, false),
    address = nullif(p_payload->>'address', ''),
    education = nullif(p_payload->>'education', ''),
    religion = nullif(p_payload->>'religion', ''),
    phone = nullif(p_payload->>'phone', ''),
    email = nullif(p_payload->>'email', ''),
    public_fields = coalesce(p_payload->'publicFields', public_fields),
    updated_at = now()
  where id = p_person_id;
  if nullif(p_payload->>'avatarUrl', '') is not null then
    update public.media_assets set
      is_public = coalesce((p_payload->>'isDeceased')::boolean, false) or coalesce((p_payload->'publicFields'->>'avatar')::boolean, false)
    where id = replace(p_payload->>'avatarUrl', '/api/public/media/', '')::uuid and tenant_id = v_person.tenant_id;
    if not found then raise exception 'INVALID_AVATAR'; end if;
  end if;
  update public.family_trees set graph_version = graph_version + 1, updated_at = now() where id = v_tree.id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_person.tenant_id, auth.uid(), 'person.updated', 'person', p_person_id::text);
  return jsonb_build_object('updated', true, 'graphVersion', p_expected_version + 1);
end;
$$;

revoke all on function public.add_related_person_with_version(uuid, bigint, uuid, text, text, text, public.person_gender, public.relationship_type) from public, anon;
revoke all on function public.update_person_with_version(uuid, bigint, jsonb) from public, anon;
grant execute on function public.add_related_person_with_version(uuid, bigint, uuid, text, text, text, public.person_gender, public.relationship_type) to authenticated;
grant execute on function public.update_person_with_version(uuid, bigint, jsonb) to authenticated;

create or replace function public.audit_tenant_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end; v_tenant_id uuid; v_entity_id text;
begin
  v_tenant_id := nullif(v_row->>'tenant_id', '')::uuid;
  v_entity_id := coalesce(v_row->>'id', v_row->>'tenant_id');
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_tenant_id, auth.uid(), tg_table_name || '.' || lower(tg_op), tg_table_name, v_entity_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger categories_audit after insert or update or delete on public.categories for each row execute function public.audit_tenant_table_change();
create trigger posts_audit after insert or update or delete on public.posts for each row execute function public.audit_tenant_table_change();
create trigger events_audit after insert or update or delete on public.events for each row execute function public.audit_tenant_table_change();
create trigger albums_audit after insert or update or delete on public.albums for each row execute function public.audit_tenant_table_change();
create trigger media_assets_audit after update or delete on public.media_assets for each row execute function public.audit_tenant_table_change();
create trigger contacts_audit after update or delete on public.contact_messages for each row execute function public.audit_tenant_table_change();
create trigger settings_audit after insert or update or delete on public.tenant_settings for each row execute function public.audit_tenant_table_change();

create or replace function public.attach_media_to_album(p_asset_id uuid, p_album_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_asset public.media_assets%rowtype; v_album public.albums%rowtype;
begin
  select * into v_asset from public.media_assets where id = p_asset_id for update;
  select * into v_album from public.albums where id = p_album_id for update;
  if v_asset.id is null or v_album.id is null or v_asset.tenant_id <> v_album.tenant_id or not public.is_tenant_member(v_asset.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_asset.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_asset.album_id is distinct from p_album_id then
    if v_asset.album_id is not null then update public.albums set image_count = greatest(0, image_count - 1) where id = v_asset.album_id; end if;
    update public.media_assets set album_id = p_album_id, is_public = (v_album.status = 'published') where id = p_asset_id;
    update public.albums set image_count = image_count + 1, cover_url = coalesce(cover_url, '/api/public/media/' || p_asset_id::text), updated_at = now() where id = p_album_id;
  end if;
  return true;
end;
$$;
revoke all on function public.attach_media_to_album(uuid, uuid) from public, anon;
grant execute on function public.attach_media_to_album(uuid, uuid) to authenticated;

create or replace function public.update_tenant_branding(p_tenant_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_tenant public.tenants%rowtype; v_theme jsonb; v_published boolean;
begin
  select * into v_tenant from public.tenants where id = p_tenant_id for update;
  if v_tenant.id is null or not public.is_tenant_member(v_tenant.id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_tenant.id) then raise exception 'TENANT_READ_ONLY'; end if;
  if char_length(btrim(p_payload->>'name')) not between 2 and 160 or char_length(btrim(p_payload->>'shortName')) not between 2 and 100 then raise exception 'INVALID_INPUT'; end if;
  v_theme := jsonb_build_object(
    'primaryColor', p_payload->>'primaryColor',
    'accentColor', p_payload->>'accentColor',
    'logoUrl', nullif(p_payload->>'logoUrl', ''),
    'bannerUrl', nullif(p_payload->>'bannerUrl', '')
  );
  v_published := coalesce((p_payload->>'published')::boolean, false);
  if v_published and (nullif(btrim(p_payload->>'introduction'), '') is null or not exists (select 1 from public.family_trees where tenant_id = p_tenant_id and archived_at is null)) then raise exception 'PUBLISH_REQUIREMENTS'; end if;
  update public.tenants set
    name = btrim(p_payload->>'name'), short_name = btrim(p_payload->>'shortName'),
    introduction = nullif(btrim(p_payload->>'introduction'), ''), chronicle = nullif(btrim(p_payload->>'chronicle'), ''),
    address = nullif(btrim(p_payload->>'address'), ''), contact_email = nullif(btrim(p_payload->>'contactEmail'), ''),
    contact_phone = nullif(btrim(p_payload->>'contactPhone'), ''), map_url = nullif(btrim(p_payload->>'mapUrl'), ''),
    theme = v_theme, published = v_published, updated_at = now()
  where id = p_tenant_id;
  update public.tenant_settings set seo = coalesce(p_payload->'seo', seo), onboarding = onboarding || jsonb_build_object('brandingCompleted', true, 'published', v_published), updated_at = now() where tenant_id = p_tenant_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_tenant_id, auth.uid(), 'tenant.branding_updated', 'tenant', p_tenant_id::text, jsonb_build_object('published', v_published));
  return jsonb_build_object('updated', true, 'published', v_published);
end;
$$;
revoke all on function public.update_tenant_branding(uuid, jsonb) from public, anon;
grant execute on function public.update_tenant_branding(uuid, jsonb) to authenticated;

create or replace function public.remove_tenant_admin(p_tenant_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_membership public.memberships%rowtype;
begin
  if not public.is_tenant_owner(p_tenant_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_membership from public.memberships where tenant_id = p_tenant_id and user_id = p_user_id for update;
  if v_membership.id is null then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if v_membership.role = 'owner' then raise exception 'OWNER_CANNOT_BE_REMOVED'; end if;
  delete from public.memberships where id = v_membership.id;
  update public.usage_counters set admin_count = greatest(1, admin_count - 1), updated_at = now() where tenant_id = p_tenant_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (p_tenant_id, auth.uid(), 'admin.removed', 'membership', v_membership.id::text);
  return true;
end;
$$;
revoke all on function public.remove_tenant_admin(uuid, uuid) from public, anon;
grant execute on function public.remove_tenant_admin(uuid, uuid) to authenticated;
