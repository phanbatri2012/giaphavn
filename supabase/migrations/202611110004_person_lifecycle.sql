create or replace function public.soft_delete_person_with_version(p_person_id uuid, p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_person public.persons%rowtype; v_tree public.family_trees%rowtype;
begin
  select * into v_person from public.persons where id = p_person_id and archived_at is null for update;
  if v_person.id is null then raise exception 'PERSON_NOT_FOUND'; end if;
  select * into v_tree from public.family_trees where id = v_person.tree_id for update;
  if not public.is_tenant_member(v_person.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_person.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_tree.root_person_id = p_person_id then raise exception 'ROOT_PERSON'; end if;
  if exists (
    select 1 from public.parentage_links l join public.persons c on c.id = l.child_id
    where l.parent_id = p_person_id and c.archived_at is null
  ) then raise exception 'PERSON_HAS_CHILDREN'; end if;
  update public.persons set archived_at = now(), purge_after = now() + interval '30 days' where id = p_person_id;
  update public.family_trees set graph_version = graph_version + 1 where id = v_tree.id;
  update public.usage_counters set person_count = greatest(0, person_count - 1), updated_at = now() where tenant_id = v_person.tenant_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_person.tenant_id, auth.uid(), 'person.archived', 'person', p_person_id::text, jsonb_build_object('purgeAfter', now() + interval '30 days'));
  return jsonb_build_object('archived', true, 'graphVersion', p_expected_version + 1, 'restoreDays', 30);
end;
$$;

create or replace function public.restore_person_with_version(p_person_id uuid, p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_person public.persons%rowtype; v_tree public.family_trees%rowtype; v_plan public.plans%rowtype; v_count integer;
begin
  select * into v_person from public.persons where id = p_person_id and archived_at is not null for update;
  if v_person.id is null or v_person.purge_after <= now() then raise exception 'RESTORE_EXPIRED'; end if;
  select * into v_tree from public.family_trees where id = v_person.tree_id for update;
  if not public.is_tenant_member(v_person.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_person.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  select p.* into v_plan from public.subscriptions s join public.plans p on p.id = s.plan_id where s.tenant_id = v_person.tenant_id;
  select count(*) into v_count from public.persons where tenant_id = v_person.tenant_id and archived_at is null;
  if v_count >= v_plan.member_limit then raise exception 'MEMBER_LIMIT'; end if;
  update public.persons set archived_at = null, purge_after = null where id = p_person_id;
  update public.family_trees set graph_version = graph_version + 1 where id = v_tree.id;
  update public.usage_counters set person_count = person_count + 1, updated_at = now() where tenant_id = v_person.tenant_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_person.tenant_id, auth.uid(), 'person.restored', 'person', p_person_id::text);
  return jsonb_build_object('restored', true, 'graphVersion', p_expected_version + 1);
end;
$$;

revoke all on function public.soft_delete_person_with_version(uuid, bigint) from public, anon;
revoke all on function public.restore_person_with_version(uuid, bigint) from public, anon;
grant execute on function public.soft_delete_person_with_version(uuid, bigint) to authenticated;
grant execute on function public.restore_person_with_version(uuid, bigint) to authenticated;

