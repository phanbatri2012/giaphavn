-- Import previews are created only by the server after workbook validation.
-- Media rows and storage objects are likewise created through signed upload +
-- finalize RPC, preventing quota bypass through direct PostgREST/Storage calls.
drop policy if exists imports_member_insert on public.import_jobs;
drop policy if exists media_member_insert on public.media_assets;
drop policy if exists media_member_update on public.media_assets;
drop policy if exists media_member_delete on public.media_assets;
drop policy if exists tenant_media_member_insert on storage.objects;

create or replace function public.tenant_can_mutate(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.tenants t
    join public.subscriptions s on s.tenant_id = t.id
    where t.id = p_tenant_id
      and t.locked_at is null
      and t.deletion_requested_at is null
      and s.status in ('free', 'active')
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

create or replace function public.set_album_media_visibility(p_album_id uuid, p_is_public boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_album public.albums%rowtype; v_count integer;
begin
  select * into v_album from public.albums where id = p_album_id for update;
  if v_album.id is null or not public.is_tenant_member(v_album.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_album.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  update public.media_assets set is_public = p_is_public where album_id = p_album_id and tenant_id = v_album.tenant_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.delete_media_asset(p_asset_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_asset public.media_assets%rowtype;
begin
  select * into v_asset from public.media_assets where id = p_asset_id for update;
  if v_asset.id is null or not public.is_tenant_member(v_asset.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_asset.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_asset.album_id is not null then
    update public.albums set
      image_count = greatest(0, image_count - 1),
      cover_url = case when cover_url = '/api/public/media/' || p_asset_id::text then (
        select '/api/public/media/' || id::text from public.media_assets where album_id = v_asset.album_id and id <> p_asset_id order by created_at limit 1
      ) else cover_url end,
      updated_at = now()
    where id = v_asset.album_id;
  end if;
  update public.usage_counters set storage_bytes = greatest(0, storage_bytes - v_asset.size_bytes), updated_at = now() where tenant_id = v_asset.tenant_id;
  delete from public.media_assets where id = p_asset_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_asset.tenant_id, auth.uid(), 'media.deleted', 'media_asset', p_asset_id::text, jsonb_build_object('sizeBytes', v_asset.size_bytes));
  return jsonb_build_object('deleted', true, 'storagePath', v_asset.storage_path);
end;
$$;

revoke all on function public.set_album_media_visibility(uuid, boolean) from public, anon;
revoke all on function public.delete_media_asset(uuid) from public, anon;
grant execute on function public.set_album_media_visibility(uuid, boolean) to authenticated;
grant execute on function public.delete_media_asset(uuid) to authenticated;

create or replace function public.commit_import_job(p_job_id uuid, p_accept_warnings boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.import_jobs%rowtype;
  v_tree public.family_trees%rowtype;
  v_plan public.plans%rowtype;
  v_row jsonb;
  v_row_id text;
  v_person_id uuid;
  v_parent_id uuid;
  v_union_id uuid;
  v_spouse_row_id text;
  v_map jsonb := '{}'::jsonb;
  v_union_keys jsonb := '{}'::jsonb;
  v_pair_key text;
  v_existing integer;
  v_new integer;
  v_file_people integer;
  v_first_person uuid;
  v_relationship public.relationship_type;
begin
  select * into v_job from public.import_jobs where id = p_job_id for update;
  if v_job.id is null or v_job.status <> 'ready' or v_job.expires_at <= now() then raise exception 'IMPORT_NOT_READY'; end if;
  if v_job.created_by <> auth.uid() or not public.is_tenant_member(v_job.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if v_job.warning_count > 0 and not p_accept_warnings then raise exception 'WARNINGS_NOT_ACCEPTED'; end if;
  select * into v_tree from public.family_trees where id = v_job.tree_id and tenant_id = v_job.tenant_id and archived_at is null for update;
  if v_tree.graph_version <> (v_job.preview_payload->>'expectedVersion')::bigint then raise exception 'VERSION_CONFLICT'; end if;
  if not public.tenant_can_mutate(v_job.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;

  select p.* into v_plan from public.subscriptions s join public.plans p on p.id = s.plan_id where s.tenant_id = v_job.tenant_id;
  select count(*) into v_existing from public.persons where tenant_id = v_job.tenant_id and archived_at is null;
  select count(*) into v_new from jsonb_array_elements(v_job.preview_payload->'rows') r where nullif(r->>'personId', '') is null;
  if v_existing + v_new > v_plan.member_limit then raise exception 'MEMBER_LIMIT'; end if;

  if v_job.mode = 'create' and exists (
    select 1 from jsonb_array_elements(v_job.preview_payload->'rows') r where nullif(r->>'personId', '') is not null
  ) then raise exception 'CREATE_CONTAINS_PERSON_ID'; end if;

  if v_job.mode = 'update' then
    select count(*) into v_file_people from jsonb_array_elements(v_job.preview_payload->'rows');
    if v_file_people <> (select count(*) from public.persons where tree_id = v_job.tree_id and archived_at is null) then
      raise exception 'INCOMPLETE_UPDATE_EXPORT';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_job.preview_payload->'rows') r
      left join public.persons p on p.id = (r->>'personId')::uuid and p.tree_id = v_job.tree_id and p.archived_at is null
      where nullif(r->>'personId', '') is null or p.id is null
    ) then raise exception 'INVALID_PERSON_ID'; end if;
  end if;

  for v_row in select * from jsonb_array_elements(v_job.preview_payload->'rows') loop
    v_row_id := v_row->>'rowId';
    if nullif(v_row->>'personId', '') is not null then
      v_person_id := (v_row->>'personId')::uuid;
      update public.persons set
        full_name = v_row->>'fullName',
        search_name = v_row->>'searchName',
        gender = (v_row->>'gender')::public.person_gender,
        generation = (v_row->>'generation')::integer,
        other_name = nullif(v_row->>'otherName', ''),
        role_title = nullif(v_row->>'roleTitle', ''),
        birth_date = public.parse_partial_date(nullif(v_row->>'birthValue', ''), coalesce((nullif(v_row->>'birthPrecision', ''))::public.date_precision, 'day')),
        birth_precision = (nullif(v_row->>'birthPrecision', ''))::public.date_precision,
        birth_calendar = coalesce((nullif(v_row->>'birthCalendar', ''))::public.calendar_type, 'solar'),
        is_deceased = coalesce((v_row->>'isDeceased')::boolean, false),
        updated_at = now()
      where id = v_person_id and tree_id = v_job.tree_id and archived_at is null;
      if not found then raise exception 'INVALID_PERSON_ID'; end if;
    else
      insert into public.persons (
        tenant_id, tree_id, full_name, search_name, gender, generation,
        other_name, role_title, birth_date, birth_precision, birth_calendar, is_deceased
      ) values (
        v_job.tenant_id, v_job.tree_id, v_row->>'fullName', v_row->>'searchName',
        (v_row->>'gender')::public.person_gender, (v_row->>'generation')::integer,
        nullif(v_row->>'otherName', ''), nullif(v_row->>'roleTitle', ''),
        public.parse_partial_date(nullif(v_row->>'birthValue', ''), coalesce((nullif(v_row->>'birthPrecision', ''))::public.date_precision, 'day')),
        (nullif(v_row->>'birthPrecision', ''))::public.date_precision,
        coalesce((nullif(v_row->>'birthCalendar', ''))::public.calendar_type, 'solar'),
        coalesce((v_row->>'isDeceased')::boolean, false)
      ) returning id into v_person_id;
    end if;
    if v_first_person is null then v_first_person := v_person_id; end if;
    v_map := v_map || jsonb_build_object(v_row_id, v_person_id::text);
  end loop;

  -- Update files represent a complete system export. Rebuild their graph so
  -- removed parent/spouse links do not survive an update import.
  if v_job.mode = 'update' then
    delete from public.parentage_links where tree_id = v_job.tree_id;
    delete from public.unions where tree_id = v_job.tree_id;
  end if;

  for v_row in select * from jsonb_array_elements(v_job.preview_payload->'rows') loop
    v_person_id := (v_map->>(v_row->>'rowId'))::uuid;
    v_relationship := coalesce((nullif(v_row->>'relationshipType', ''))::public.relationship_type, 'biological');
    if nullif(v_row->>'fatherRowId', '') is not null then
      v_parent_id := (v_map->>(v_row->>'fatherRowId'))::uuid;
      insert into public.parentage_links (tenant_id, tree_id, parent_id, child_id, relationship_type)
      values (v_job.tenant_id, v_job.tree_id, v_parent_id, v_person_id, v_relationship)
      on conflict (parent_id, child_id, relationship_type) do nothing;
    end if;
    if nullif(v_row->>'motherRowId', '') is not null then
      v_parent_id := (v_map->>(v_row->>'motherRowId'))::uuid;
      insert into public.parentage_links (tenant_id, tree_id, parent_id, child_id, relationship_type)
      values (v_job.tenant_id, v_job.tree_id, v_parent_id, v_person_id, v_relationship)
      on conflict (parent_id, child_id, relationship_type) do nothing;
    end if;
    for v_spouse_row_id in select value from jsonb_array_elements_text(coalesce(v_row->'spouseRowIds', '[]'::jsonb)) loop
      v_pair_key := least(v_row->>'rowId', v_spouse_row_id) || ':' || greatest(v_row->>'rowId', v_spouse_row_id);
      if not (v_union_keys ? v_pair_key) then
        insert into public.unions (tenant_id, tree_id) values (v_job.tenant_id, v_job.tree_id) returning id into v_union_id;
        insert into public.union_partners (tenant_id, tree_id, union_id, person_id, sort_order) values
          (v_job.tenant_id, v_job.tree_id, v_union_id, v_person_id, 0),
          (v_job.tenant_id, v_job.tree_id, v_union_id, (v_map->>v_spouse_row_id)::uuid, 1);
        v_union_keys := v_union_keys || jsonb_build_object(v_pair_key, v_union_id::text);
      end if;
    end loop;
  end loop;

  if v_tree.root_person_id is null and v_first_person is not null then
    update public.family_trees set root_person_id = v_first_person where id = v_tree.id;
  end if;
  update public.family_trees set graph_version = graph_version + 1, updated_at = now() where id = v_tree.id;
  update public.usage_counters set
    person_count = (select count(*) from public.persons where tenant_id = v_job.tenant_id and archived_at is null),
    updated_at = now()
  where tenant_id = v_job.tenant_id;
  update public.import_jobs set status = 'committed', committed_at = now(), preview_payload = null where id = v_job.id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_job.tenant_id, auth.uid(), 'import.committed', 'import_job', v_job.id::text, jsonb_build_object('rows', v_job.row_count, 'mode', v_job.mode));
  return jsonb_build_object('committed', true, 'rows', v_job.row_count, 'graphVersion', v_tree.graph_version + 1);
end;
$$;

revoke all on function public.commit_import_job(uuid, boolean) from public, anon;
grant execute on function public.commit_import_job(uuid, boolean) to authenticated;
