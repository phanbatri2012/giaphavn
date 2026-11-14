create or replace function public.update_person_with_version(
  p_person_id uuid,
  p_expected_version bigint,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person public.persons%rowtype;
  v_tree public.family_trees%rowtype;
  v_birth_precision public.date_precision;
  v_death_precision public.date_precision;
  v_old_avatar_id uuid;
  v_new_avatar_id uuid;
  v_avatar_public boolean := coalesce((p_payload->'publicFields'->>'avatar')::boolean, false);
begin
  select * into v_person from public.persons where id = p_person_id and archived_at is null for update;
  if v_person.id is null or not public.is_tenant_member(v_person.tenant_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_tree from public.family_trees where id = v_person.tree_id and archived_at is null for update;
  if not public.tenant_can_mutate(v_person.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if v_tree.graph_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if char_length(btrim(p_payload->>'fullName')) not between 2 and 150 then raise exception 'INVALID_INPUT'; end if;

  v_birth_precision := coalesce((nullif(p_payload->>'birthPrecision', ''))::public.date_precision, 'day');
  v_death_precision := coalesce((nullif(p_payload->>'deathPrecision', ''))::public.date_precision, 'day');

  if nullif(v_person.avatar_url, '') is not null and v_person.avatar_url ~* '[0-9a-f-]{36}$' then
    v_old_avatar_id := substring(v_person.avatar_url from '([0-9a-fA-F-]{36})$')::uuid;
  end if;

  if nullif(p_payload->>'avatarUrl', '') is not null then
    if p_payload->>'avatarUrl' !~* '^/api/(public/)?media/[0-9a-f-]{36}$' then raise exception 'INVALID_AVATAR'; end if;
    v_new_avatar_id := substring(p_payload->>'avatarUrl' from '([0-9a-fA-F-]{36})$')::uuid;
    perform 1 from public.media_assets where id = v_new_avatar_id and tenant_id = v_person.tenant_id;
    if not found then raise exception 'INVALID_AVATAR'; end if;
  end if;

  if v_old_avatar_id is not null and v_old_avatar_id is distinct from v_new_avatar_id then
    update public.media_assets set is_public = false where id = v_old_avatar_id and tenant_id = v_person.tenant_id;
  end if;

  update public.persons set
    full_name = btrim(p_payload->>'fullName'),
    search_name = p_payload->>'searchName',
    other_name = nullif(p_payload->>'otherName', ''),
    gender = (p_payload->>'gender')::public.person_gender,
    role_title = nullif(p_payload->>'roleTitle', ''),
    avatar_url = case
      when v_new_avatar_id is null then null
      when v_avatar_public then '/api/public/media/' || v_new_avatar_id::text
      else '/api/media/' || v_new_avatar_id::text
    end,
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

  if v_new_avatar_id is not null then
    update public.media_assets set is_public = v_avatar_public
    where id = v_new_avatar_id and tenant_id = v_person.tenant_id;
  end if;

  update public.family_trees set graph_version = graph_version + 1, updated_at = now() where id = v_tree.id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_person.tenant_id, auth.uid(), 'person.updated', 'person', p_person_id::text);
  return jsonb_build_object('updated', true, 'graphVersion', p_expected_version + 1);
end;
$$;

-- Repair avatar visibility created by the earlier deceased-person shortcut.
with avatar_settings as (
  select
    p.tenant_id,
    substring(p.avatar_url from '([0-9a-fA-F-]{36})$')::uuid as asset_id,
    coalesce((p.public_fields->>'avatar')::boolean, false) as is_public
  from public.persons p
  where p.avatar_url ~* '^/api/(public/)?media/[0-9a-f-]{36}$'
)
update public.media_assets asset
set is_public = settings.is_public
from avatar_settings settings
where asset.id = settings.asset_id
  and asset.tenant_id = settings.tenant_id
  and asset.album_id is null;

update public.persons p
set avatar_url = case
  when coalesce((p.public_fields->>'avatar')::boolean, false)
    then '/api/public/media/' || substring(p.avatar_url from '([0-9a-fA-F-]{36})$')
  else '/api/media/' || substring(p.avatar_url from '([0-9a-fA-F-]{36})$')
end
where p.avatar_url ~* '^/api/(public/)?media/[0-9a-f-]{36}$';

revoke all on function public.update_person_with_version(uuid, bigint, jsonb) from public, anon;
grant execute on function public.update_person_with_version(uuid, bigint, jsonb) to authenticated;
