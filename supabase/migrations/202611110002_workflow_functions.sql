create or replace function public.parse_partial_date(p_value text, p_precision public.date_precision)
returns date language plpgsql immutable as $$
begin
  if p_value is null or btrim(p_value) = '' then return null; end if;
  if p_precision = 'year' then return to_date(p_value || '-01-01', 'YYYY-MM-DD'); end if;
  if p_precision = 'month' then return to_date(p_value || '-01', 'YYYY-MM-DD'); end if;
  return p_value::date;
exception when others then
  raise exception 'INVALID_PARTIAL_DATE: %', p_value;
end;
$$;

create or replace function public.create_tenant_with_root(
  p_name text,
  p_slug text,
  p_root_name text,
  p_root_search_name text,
  p_root_gender public.person_gender
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_tenant_id uuid; v_tree_id uuid; v_person_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' or p_slug = any(array['app','www','api','admin','ops','support','mail','static','assets','auth','demo']) then
    raise exception 'INVALID_SLUG';
  end if;
  insert into public.tenants (owner_user_id, slug, name, short_name)
  values (v_user, p_slug, p_name, p_name) returning id into v_tenant_id;
  insert into public.memberships (tenant_id, user_id, role) values (v_tenant_id, v_user, 'owner');
  insert into public.tenant_settings (tenant_id, onboarding) values (v_tenant_id, '{"createdTenant":true}'::jsonb);
  insert into public.subscriptions (tenant_id, plan_id, status) values (v_tenant_id, 'free', 'free');
  insert into public.usage_counters (tenant_id, person_count, admin_count) values (v_tenant_id, 1, 1);
  insert into public.family_trees (tenant_id, name, visibility, graph_version)
  values (v_tenant_id, 'Phả đồ chính', 'public', 1) returning id into v_tree_id;
  insert into public.persons (tenant_id, tree_id, full_name, search_name, gender, generation, role_title)
  values (v_tenant_id, v_tree_id, p_root_name, p_root_search_name, p_root_gender, 1, 'Thành viên gốc') returning id into v_person_id;
  update public.family_trees set root_person_id = v_person_id where id = v_tree_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_tenant_id, v_user, 'tenant.created', 'tenant', v_tenant_id::text);
  return jsonb_build_object('tenantId', v_tenant_id, 'treeId', v_tree_id, 'rootPersonId', v_person_id);
end;
$$;

create or replace function public.create_union_with_version(
  p_tree_id uuid,
  p_expected_version bigint,
  p_partner_ids uuid[],
  p_child_ids uuid[] default '{}'::uuid[],
  p_relationship_type public.relationship_type default 'biological'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tree public.family_trees%rowtype; v_union_id uuid; v_partner uuid; v_child uuid;
begin
  select * into v_tree from public.family_trees where id = p_tree_id and archived_at is null for update;
  if v_tree.id is null or not public.is_tenant_member(v_tree.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_tree.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if cardinality(p_partner_ids) not between 1 and 2 or cardinality(array(select distinct unnest(p_partner_ids))) <> cardinality(p_partner_ids) then raise exception 'INVALID_PARTNERS'; end if;
  if (select count(*) from public.persons where tree_id = p_tree_id and id = any(p_partner_ids) and archived_at is null) <> cardinality(p_partner_ids) then raise exception 'INVALID_PARTNERS'; end if;
  if cardinality(p_child_ids) > 0 and (select count(*) from public.persons where tree_id = p_tree_id and id = any(p_child_ids) and archived_at is null) <> cardinality(p_child_ids) then raise exception 'INVALID_CHILDREN'; end if;
  insert into public.unions (tenant_id, tree_id) values (v_tree.tenant_id, p_tree_id) returning id into v_union_id;
  foreach v_partner in array p_partner_ids loop
    insert into public.union_partners (tenant_id, tree_id, union_id, person_id) values (v_tree.tenant_id, p_tree_id, v_union_id, v_partner);
  end loop;
  foreach v_child in array p_child_ids loop
    foreach v_partner in array p_partner_ids loop
      insert into public.parentage_links (tenant_id, tree_id, parent_id, child_id, union_id, relationship_type)
      values (v_tree.tenant_id, p_tree_id, v_partner, v_child, v_union_id, p_relationship_type)
      on conflict (parent_id, child_id, relationship_type) do update set union_id = excluded.union_id;
    end loop;
  end loop;
  update public.family_trees set graph_version = graph_version + 1 where id = p_tree_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_tree.tenant_id, auth.uid(), 'union.created', 'union', v_union_id::text);
  return jsonb_build_object('id', v_union_id, 'graphVersion', p_expected_version + 1);
end;
$$;

create or replace function public.commit_import_job(p_job_id uuid, p_accept_warnings boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_job public.import_jobs%rowtype; v_tree public.family_trees%rowtype; v_plan public.plans%rowtype;
  v_row jsonb; v_row_id text; v_person_id uuid; v_parent_id uuid; v_union_id uuid; v_spouse_row_id text;
  v_map jsonb := '{}'::jsonb; v_union_keys jsonb := '{}'::jsonb; v_pair_key text;
  v_existing integer; v_new integer; v_first_person uuid; v_relationship public.relationship_type;
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

  for v_row in select * from jsonb_array_elements(v_job.preview_payload->'rows') loop
    v_row_id := v_row->>'rowId';
    if nullif(v_row->>'personId', '') is not null then
      v_person_id := (v_row->>'personId')::uuid;
      update public.persons set
        full_name = v_row->>'fullName', search_name = v_row->>'searchName', gender = (v_row->>'gender')::public.person_gender,
        generation = (v_row->>'generation')::integer, other_name = nullif(v_row->>'otherName', ''), role_title = nullif(v_row->>'roleTitle', ''),
        birth_date = public.parse_partial_date(nullif(v_row->>'birthValue', ''), coalesce((nullif(v_row->>'birthPrecision', ''))::public.date_precision, 'day')),
        birth_precision = (nullif(v_row->>'birthPrecision', ''))::public.date_precision,
        birth_calendar = coalesce((nullif(v_row->>'birthCalendar', ''))::public.calendar_type, 'solar'),
        is_deceased = coalesce((v_row->>'isDeceased')::boolean, false)
      where id = v_person_id and tree_id = v_job.tree_id and archived_at is null;
      if not found then raise exception 'INVALID_PERSON_ID'; end if;
    else
      insert into public.persons (tenant_id, tree_id, full_name, search_name, gender, generation, other_name, role_title, birth_date, birth_precision, birth_calendar, is_deceased)
      values (
        v_job.tenant_id, v_job.tree_id, v_row->>'fullName', v_row->>'searchName', (v_row->>'gender')::public.person_gender,
        (v_row->>'generation')::integer, nullif(v_row->>'otherName', ''), nullif(v_row->>'roleTitle', ''),
        public.parse_partial_date(nullif(v_row->>'birthValue', ''), coalesce((nullif(v_row->>'birthPrecision', ''))::public.date_precision, 'day')),
        (nullif(v_row->>'birthPrecision', ''))::public.date_precision,
        coalesce((nullif(v_row->>'birthCalendar', ''))::public.calendar_type, 'solar'), coalesce((v_row->>'isDeceased')::boolean, false)
      ) returning id into v_person_id;
    end if;
    if v_first_person is null then v_first_person := v_person_id; end if;
    v_map := v_map || jsonb_build_object(v_row_id, v_person_id::text);
  end loop;

  for v_row in select * from jsonb_array_elements(v_job.preview_payload->'rows') loop
    v_person_id := (v_map->>(v_row->>'rowId'))::uuid;
    v_relationship := coalesce((nullif(v_row->>'relationshipType', ''))::public.relationship_type, 'biological');
    if nullif(v_row->>'fatherRowId', '') is not null then
      v_parent_id := (v_map->>(v_row->>'fatherRowId'))::uuid;
      insert into public.parentage_links (tenant_id, tree_id, parent_id, child_id, relationship_type)
      values (v_job.tenant_id, v_job.tree_id, v_parent_id, v_person_id, v_relationship) on conflict do nothing;
    end if;
    if nullif(v_row->>'motherRowId', '') is not null then
      v_parent_id := (v_map->>(v_row->>'motherRowId'))::uuid;
      insert into public.parentage_links (tenant_id, tree_id, parent_id, child_id, relationship_type)
      values (v_job.tenant_id, v_job.tree_id, v_parent_id, v_person_id, v_relationship) on conflict do nothing;
    end if;
    for v_spouse_row_id in select value from jsonb_array_elements_text(coalesce(v_row->'spouseRowIds', '[]'::jsonb)) loop
      v_pair_key := least(v_row->>'rowId', v_spouse_row_id) || ':' || greatest(v_row->>'rowId', v_spouse_row_id);
      if not (v_union_keys ? v_pair_key) then
        insert into public.unions (tenant_id, tree_id) values (v_job.tenant_id, v_job.tree_id) returning id into v_union_id;
        insert into public.union_partners (tenant_id, tree_id, union_id, person_id) values
          (v_job.tenant_id, v_job.tree_id, v_union_id, v_person_id),
          (v_job.tenant_id, v_job.tree_id, v_union_id, (v_map->>v_spouse_row_id)::uuid);
        v_union_keys := v_union_keys || jsonb_build_object(v_pair_key, v_union_id::text);
      end if;
    end loop;
  end loop;

  if v_tree.root_person_id is null and v_first_person is not null then update public.family_trees set root_person_id = v_first_person where id = v_tree.id; end if;
  update public.family_trees set graph_version = graph_version + 1 where id = v_tree.id;
  update public.usage_counters set person_count = (select count(*) from public.persons where tenant_id = v_job.tenant_id and archived_at is null), updated_at = now() where tenant_id = v_job.tenant_id;
  update public.import_jobs set status = 'committed', committed_at = now(), preview_payload = null where id = v_job.id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_job.tenant_id, auth.uid(), 'import.committed', 'import_job', v_job.id::text, jsonb_build_object('rows', v_job.row_count));
  return jsonb_build_object('committed', true, 'rows', v_job.row_count, 'graphVersion', v_tree.graph_version + 1);
end;
$$;

create or replace function public.mark_expired_subscriptions_read_only()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update public.subscriptions set status = 'read_only', updated_at = now()
  where status = 'active' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.create_tenant_with_root(text, text, text, text, public.person_gender) from public, anon;
revoke all on function public.create_union_with_version(uuid, bigint, uuid[], uuid[], public.relationship_type) from public, anon;
revoke all on function public.commit_import_job(uuid, boolean) from public, anon;
revoke all on function public.mark_expired_subscriptions_read_only() from public, anon, authenticated;
grant execute on function public.create_tenant_with_root(text, text, text, text, public.person_gender) to authenticated;
grant execute on function public.create_union_with_version(uuid, bigint, uuid[], uuid[], public.relationship_type) to authenticated;
grant execute on function public.commit_import_job(uuid, boolean) to authenticated;
grant execute on function public.mark_expired_subscriptions_read_only() to service_role;

