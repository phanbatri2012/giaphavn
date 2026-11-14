create or replace function public.finalize_media_asset(
  p_tenant_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_width integer default null,
  p_height integer default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_usage public.usage_counters%rowtype; v_limit bigint; v_asset_id uuid;
begin
  if not public.is_tenant_member(p_tenant_id) then raise exception 'FORBIDDEN'; end if;
  if not public.tenant_can_mutate(p_tenant_id) then raise exception 'TENANT_READ_ONLY'; end if;
  if split_part(p_storage_path, '/', 1) <> p_tenant_id::text then raise exception 'INVALID_STORAGE_PATH'; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif') or p_size_bytes <= 0 or p_size_bytes > 10485760 then raise exception 'INVALID_MEDIA'; end if;
  select * into v_usage from public.usage_counters where tenant_id = p_tenant_id for update;
  select p.storage_limit_bytes into v_limit from public.subscriptions s join public.plans p on p.id = s.plan_id where s.tenant_id = p_tenant_id;
  select id into v_asset_id from public.media_assets where storage_path = p_storage_path;
  if v_asset_id is not null then return v_asset_id; end if;
  if v_usage.storage_bytes + p_size_bytes > v_limit then raise exception 'STORAGE_LIMIT'; end if;
  insert into public.media_assets (tenant_id, storage_path, mime_type, size_bytes, width, height, created_by)
  values (p_tenant_id, p_storage_path, p_mime_type, p_size_bytes, p_width, p_height, auth.uid()) returning id into v_asset_id;
  update public.usage_counters set storage_bytes = storage_bytes + p_size_bytes, updated_at = now() where tenant_id = p_tenant_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_tenant_id, auth.uid(), 'media.created', 'media_asset', v_asset_id::text, jsonb_build_object('sizeBytes', p_size_bytes, 'mimeType', p_mime_type));
  return v_asset_id;
end;
$$;

revoke all on function public.finalize_media_asset(uuid, text, text, bigint, integer, integer) from public, anon;
grant execute on function public.finalize_media_asset(uuid, text, text, bigint, integer, integer) to authenticated;

