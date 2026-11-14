begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'billing@example.test', crypt('test-password', gen_salt('bf')), now(), '{}', '{}', now(), now());

set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
select public.create_tenant_with_root('Họ thanh toán', 'ho-thanh-toan', 'Người gốc', 'nguoi goc', 'male');
reset role;

create temporary table billing_scope as select id as tenant_id from public.tenants where slug = 'ho-thanh-toan';
grant select on billing_scope to service_role;
insert into public.payment_orders (tenant_id, plan_id, kind, amount, status, payos_order_code)
values ((select tenant_id from billing_scope), 'basic', 'purchase', 499000, 'pending', 10001);

set local role service_role;
select throws_ok(
  $$select public.apply_successful_payment(10001, 'REF-WRONG-AMOUNT', 1, '{}'::jsonb)$$,
  'P0001', 'ORDER_MISMATCH', 'a signed webhook still cannot apply the wrong amount'
);
select ok((public.apply_successful_payment(10001, 'REF-PURCHASE', 499000, '{"code":"00"}'::jsonb)->>'applied')::boolean, 'valid purchase is applied');
select is((select status from public.payment_orders where payos_order_code = 10001), 'paid', 'payment order is marked paid');
select ok((select expires_at between now() + interval '364 days' and now() + interval '366 days' from public.subscriptions where tenant_id = (select tenant_id from billing_scope)), 'purchase starts a 365-day period');

create temporary table first_expiry as select expires_at from public.subscriptions where tenant_id = (select tenant_id from billing_scope);
grant select on first_expiry to service_role;
select ok((public.apply_successful_payment(10001, 'REF-PURCHASE', 499000, '{}'::jsonb)->>'idempotent')::boolean, 'duplicate webhook is idempotent');
select is((select expires_at from public.subscriptions where tenant_id = (select tenant_id from billing_scope)), (select expires_at from first_expiry), 'duplicate webhook does not extend the subscription twice');

reset role;
insert into public.payment_orders (tenant_id, plan_id, kind, amount, status, payos_order_code)
values ((select tenant_id from billing_scope), 'basic', 'renew', 499000, 'pending', 10002);
set local role service_role;
do $$begin perform public.apply_successful_payment(10002, 'REF-RENEW', 499000, '{}'::jsonb); end$$;
select ok((select s.expires_at > f.expires_at + interval '364 days' from public.subscriptions s cross join first_expiry f where s.tenant_id = (select tenant_id from billing_scope)), 'renewal adds another 365 days after the old expiry');

reset role;
insert into public.payment_orders (tenant_id, plan_id, kind, amount, status, payos_order_code)
values ((select tenant_id from billing_scope), 'community', 'upgrade', 999000, 'pending', 10003);
set local role service_role;
do $$begin perform public.apply_successful_payment(10003, 'REF-UPGRADE', 999000, '{}'::jsonb); end$$;
select ok((select plan_id = 'community' and expires_at between now() + interval '364 days' and now() + interval '366 days' from public.subscriptions where tenant_id = (select tenant_id from billing_scope)), 'upgrade starts a new full-price 365-day cycle');

select * from finish();
rollback;
