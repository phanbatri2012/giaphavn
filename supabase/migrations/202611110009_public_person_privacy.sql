-- Keep every sensitive field private unless an administrator explicitly enables it.
-- A death date remains public for deceased members, while birth/contact/biography
-- follow their individual privacy switches for both living and deceased members.
create or replace view public.persons_public
with (security_barrier = true) as
select
  p.id,
  p.tenant_id,
  p.tree_id,
  p.full_name,
  p.search_name,
  p.other_name,
  p.gender,
  p.role_title,
  p.generation,
  case when coalesce((p.public_fields->>'avatar')::boolean, false) then p.avatar_url end as avatar_url,
  case when coalesce((p.public_fields->>'biography')::boolean, false) then p.biography end as biography,
  case when coalesce((p.public_fields->>'exactBirthDate')::boolean, false) then p.birth_date end as birth_date,
  p.birth_precision,
  p.birth_calendar,
  case when p.is_deceased then p.death_date end as death_date,
  p.death_precision,
  p.death_calendar,
  p.is_deceased,
  case when coalesce((p.public_fields->>'address')::boolean, false) then p.address end as address,
  case when coalesce((p.public_fields->>'phone')::boolean, false) then p.phone end as phone,
  case when coalesce((p.public_fields->>'email')::boolean, false) then p.email end as email,
  p.sort_order
from public.persons p
join public.family_trees ft on ft.id = p.tree_id and ft.tenant_id = p.tenant_id
join public.tenants t on t.id = p.tenant_id
where p.archived_at is null
  and ft.archived_at is null
  and ft.visibility = 'public'
  and t.published
  and t.locked_at is null
  and t.deletion_requested_at is null;

grant select on public.persons_public to anon, authenticated;
