begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@example.test', crypt('test-password', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@example.test', crypt('test-password', gen_salt('bf')), now(), '{}', '{}', now(), now());

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select public.create_tenant_with_root('Họ kiểm thử A', 'ho-kiem-thu-a', 'Nguyễn Văn Gốc', 'nguyen van goc', 'male');
reset role;

create temporary table test_scope as
select t.id as tenant_id, ft.id as tree_id, ft.root_person_id
from public.tenants t join public.family_trees ft on ft.tenant_id = t.id
where t.slug = 'ho-kiem-thu-a';
grant select on test_scope to anon, authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
select is((select count(*) from public.persons p join test_scope s on p.tenant_id = s.tenant_id), 0::bigint, 'tenant B cannot read tenant A persons');
select throws_ok(
  $$select public.add_person_with_version((select tree_id from test_scope), 1, 'Người xâm nhập', 'nguoi xam nhap', 'male', 2, null, 'biological')$$,
  'P0001', 'FORBIDDEN', 'tenant B cannot mutate tenant A tree through RPC'
);
select is((select count(*) from public.audit_logs a join test_scope s on a.tenant_id = s.tenant_id), 0::bigint, 'tenant B cannot read tenant A audit logs');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select is((select count(*) from public.persons p join test_scope s on p.tenant_id = s.tenant_id), 1::bigint, 'tenant A can read its root person');
update public.persons set full_name = 'Bypass RLS' where id = (select root_person_id from test_scope);
select is((select full_name from public.persons where id = (select root_person_id from test_scope)), 'Nguyễn Văn Gốc', 'direct genealogy updates stay blocked even for tenant members');
select throws_ok(
  $$insert into public.media_assets (tenant_id, storage_path, mime_type, size_bytes, created_by) values ((select tenant_id from test_scope), (select tenant_id::text from test_scope) || '/bypass.jpg', 'image/jpeg', 10, '10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'members cannot bypass media quota with direct inserts'
);
select throws_ok(
  $$insert into public.import_jobs (tenant_id, tree_id, created_by, mode, status, row_count, warning_count, preview_payload, expires_at) values ((select tenant_id from test_scope), (select tree_id from test_scope), '10000000-0000-0000-0000-000000000001', 'create', 'ready', 0, 0, '{}'::jsonb, now() + interval '1 hour')$$,
  '42501', null, 'members cannot inject a prevalidated import job'
);
select lives_ok(
  $$select public.add_person_with_version((select tree_id from test_scope), 1, 'Nguyễn Văn Con', 'nguyen van con', 'male', 2, (select root_person_id from test_scope), 'biological')$$,
  'owner can mutate its tree through the versioned RPC'
);
select throws_ok(
  $$select public.add_person_with_version((select tree_id from test_scope), 1, 'Phiên bản cũ', 'phien ban cu', 'male', 2, null, 'biological')$$,
  'P0001', 'VERSION_CONFLICT', 'stale graph versions are rejected'
);

reset role;
update public.tenants set published = true where id = (select tenant_id from test_scope);
update public.persons set phone = '0900000000', public_fields = jsonb_set(public_fields, '{phone}', 'false') where id = (select root_person_id from test_scope);
insert into public.posts (tenant_id, slug, title, excerpt, body_html, status)
values ((select tenant_id from test_scope), 'ban-nhap', 'Bản nháp', '', '<p>Riêng tư</p>', 'draft');

set local role anon;
set local request.jwt.claim.sub = '';
select is((select count(*) from public.persons p join test_scope s on p.tenant_id = s.tenant_id), 0::bigint, 'anonymous users cannot read base persons table');
select is((select count(*) from public.persons_public p join test_scope s on p.tenant_id = s.tenant_id where p.phone is not null), 0::bigint, 'public projection hides private living-person phone');
select is((select count(*) from public.posts p join test_scope s on p.tenant_id = s.tenant_id where p.slug = 'ban-nhap'), 0::bigint, 'draft content is never publicly readable');

reset role;
update public.persons
set is_deceased = true,
    birth_date = '1940-01-02',
    biography = 'Tiểu sử riêng',
    public_fields = public_fields || '{"exactBirthDate":false,"biography":false,"phone":false}'::jsonb
where id = (select root_person_id from test_scope);
set local role anon;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.persons_public p join test_scope s on p.tenant_id = s.tenant_id where p.birth_date is not null or p.biography is not null or p.phone is not null),
  0::bigint,
  'public projection also hides unpublished sensitive fields for deceased people'
);

reset role;
update public.family_trees set visibility = 'protected', access_code_hash = '$argon2id$test' where id = (select tree_id from test_scope);
set local role anon;
select is((select count(*) from public.family_trees ft join test_scope s on ft.id = s.tree_id), 0::bigint, 'protected trees are not exposed by base RLS');
select is((select count(*) from public.persons_public p join test_scope s on p.tree_id = s.tree_id), 0::bigint, 'protected tree people are absent from the public projection');

reset role;
update public.subscriptions set status = 'read_only' where tenant_id = (select tenant_id from test_scope);
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select throws_ok(
  $$select public.add_person_with_version((select tree_id from test_scope), 2, 'Không được ghi', 'khong duoc ghi', 'male', 2, null, 'biological')$$,
  'P0001', 'TENANT_READ_ONLY', 'read-only tenants cannot mutate data'
);

reset role;
select throws_ok(
  $$delete from public.audit_logs where tenant_id = (select tenant_id from test_scope)$$,
  'P0001', 'AUDIT_LOG_IMMUTABLE', 'audit logs are append-only even for privileged SQL'
);

select * from finish();
rollback;
