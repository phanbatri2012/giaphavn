create or replace function public.create_admin_invitation(
  p_tenant_id uuid,
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_plan public.plans%rowtype; v_used integer; v_invitation_id uuid;
begin
  if not public.is_tenant_owner(p_tenant_id) then raise exception 'OWNER_REQUIRED'; end if;
  if not public.tenant_can_mutate(p_tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  delete from public.invitations where tenant_id = p_tenant_id and lower(email) = lower(p_email) and accepted_at is null;
  select p.* into v_plan from public.subscriptions s join public.plans p on p.id = s.plan_id where s.tenant_id = p_tenant_id;
  select (select count(*) from public.memberships where tenant_id = p_tenant_id)
       + (select count(*) from public.invitations where tenant_id = p_tenant_id and accepted_at is null and expires_at > now())
    into v_used;
  if v_used >= v_plan.admin_limit then raise exception 'ADMIN_LIMIT'; end if;
  if exists (select 1 from public.memberships m join public.profiles p on p.id = m.user_id join auth.users u on u.id = p.id where m.tenant_id = p_tenant_id and lower(u.email) = lower(p_email)) then
    raise exception 'ALREADY_MEMBER';
  end if;
  insert into public.invitations (tenant_id, email, token_hash, invited_by, expires_at)
  values (p_tenant_id, lower(p_email), p_token_hash, auth.uid(), p_expires_at) returning id into v_invitation_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_tenant_id, auth.uid(), 'admin.invited', 'invitation', v_invitation_id::text, jsonb_build_object('emailHash', encode(digest(lower(p_email), 'sha256'), 'hex')));
  return v_invitation_id;
end;
$$;

create or replace function public.accept_admin_invitation(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_invitation public.invitations%rowtype; v_plan public.plans%rowtype; v_count integer; v_email text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_email := lower(coalesce(auth.jwt()->>'email', ''));
  select * into v_invitation from public.invitations where token_hash = p_token_hash for update;
  if v_invitation.id is null or v_invitation.accepted_at is not null or v_invitation.expires_at <= now() then raise exception 'INVITATION_INVALID'; end if;
  if v_email = '' or lower(v_invitation.email) <> v_email then raise exception 'EMAIL_MISMATCH'; end if;
  if not public.tenant_can_mutate(v_invitation.tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  select p.* into v_plan from public.subscriptions s join public.plans p on p.id = s.plan_id where s.tenant_id = v_invitation.tenant_id;
  select count(*) into v_count from public.memberships where tenant_id = v_invitation.tenant_id;
  if v_count >= v_plan.admin_limit then raise exception 'ADMIN_LIMIT'; end if;
  insert into public.memberships (tenant_id, user_id, role) values (v_invitation.tenant_id, auth.uid(), 'admin') on conflict (tenant_id, user_id) do nothing;
  update public.invitations set accepted_at = now() where id = v_invitation.id;
  update public.usage_counters set admin_count = (select count(*) from public.memberships where tenant_id = v_invitation.tenant_id), updated_at = now() where tenant_id = v_invitation.tenant_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
  values (v_invitation.tenant_id, auth.uid(), 'admin.invitation_accepted', 'invitation', v_invitation.id::text);
  return jsonb_build_object('accepted', true, 'tenantId', v_invitation.tenant_id);
end;
$$;

revoke all on function public.create_admin_invitation(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.accept_admin_invitation(text) from public, anon;
grant execute on function public.create_admin_invitation(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.accept_admin_invitation(text) to authenticated;
