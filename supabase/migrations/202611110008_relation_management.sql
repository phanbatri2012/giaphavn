create or replace function public.link_people_with_version(
  p_tree_id uuid,
  p_expected_version bigint,
  p_parent_id uuid,
  p_child_id uuid,
  p_relationship_type public.relationship_type default 'biological'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_tree public.family_trees%rowtype; v_link_id uuid;
begin
  select * into v_tree from public.family_trees where id = p_tree_id and archived_at is null for update;
  if v_tree.id is null or not public.is_tenant_member(v_tree.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_tree.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_parent_id = p_child_id or (select count(*) from public.persons where tree_id = p_tree_id and id in (p_parent_id, p_child_id) and archived_at is null) <> 2 then raise exception 'INVALID_PEOPLE'; end if;
  delete from public.parentage_links where tree_id = p_tree_id and parent_id = p_parent_id and child_id = p_child_id;
  insert into public.parentage_links (tenant_id, tree_id, parent_id, child_id, relationship_type)
  values (v_tree.tenant_id, p_tree_id, p_parent_id, p_child_id, p_relationship_type) returning id into v_link_id;
  update public.family_trees set graph_version = graph_version + 1, updated_at = now() where id = p_tree_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_tree.tenant_id, auth.uid(), 'parentage.linked', 'parentage_link', v_link_id::text, jsonb_build_object('parentId', p_parent_id, 'childId', p_child_id, 'relationshipType', p_relationship_type));
  return jsonb_build_object('id', v_link_id, 'graphVersion', p_expected_version + 1);
end;
$$;

create or replace function public.remove_parentage_link_with_version(p_link_id uuid, p_expected_version bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_link public.parentage_links%rowtype; v_tree public.family_trees%rowtype;
begin
  select * into v_link from public.parentage_links where id = p_link_id for update;
  if v_link.id is null then raise exception 'LINK_NOT_FOUND'; end if;
  select * into v_tree from public.family_trees where id = v_link.tree_id and archived_at is null for update;
  if not public.is_tenant_member(v_link.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_link.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  delete from public.parentage_links where id = p_link_id;
  update public.family_trees set graph_version = graph_version + 1, updated_at = now() where id = v_tree.id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_link.tenant_id, auth.uid(), 'parentage.removed', 'parentage_link', p_link_id::text);
  return jsonb_build_object('removed', true, 'graphVersion', p_expected_version + 1);
end;
$$;

create or replace function public.remove_union_with_version(p_union_id uuid, p_expected_version bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_union public.unions%rowtype; v_tree public.family_trees%rowtype;
begin
  select * into v_union from public.unions where id = p_union_id and archived_at is null for update;
  if v_union.id is null then raise exception 'UNION_NOT_FOUND'; end if;
  select * into v_tree from public.family_trees where id = v_union.tree_id and archived_at is null for update;
  if not public.is_tenant_member(v_union.tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(v_union.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  delete from public.unions where id = p_union_id;
  update public.family_trees set graph_version = graph_version + 1, updated_at = now() where id = v_tree.id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_union.tenant_id, auth.uid(), 'union.removed', 'union', p_union_id::text);
  return jsonb_build_object('removed', true, 'graphVersion', p_expected_version + 1);
end;
$$;

revoke all on function public.link_people_with_version(uuid, bigint, uuid, uuid, public.relationship_type) from public, anon;
revoke all on function public.remove_parentage_link_with_version(uuid, bigint) from public, anon;
revoke all on function public.remove_union_with_version(uuid, bigint) from public, anon;
grant execute on function public.link_people_with_version(uuid, bigint, uuid, uuid, public.relationship_type) to authenticated;
grant execute on function public.remove_parentage_link_with_version(uuid, bigint) to authenticated;
grant execute on function public.remove_union_with_version(uuid, bigint) to authenticated;
