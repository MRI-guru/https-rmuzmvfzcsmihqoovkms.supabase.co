-- Device verification may not claim verified labeling unless an approved current manufacturer source exists.
create or replace function public.quickcheck_staff_set_verification(p_entity_type text,p_entity_id uuid,p_verified boolean,p_reason text,p_source_id uuid default null,p_verified_by text default 'staff-review',p_verification_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $function$
declare oldv jsonb; newv jsonb; actor uuid:=auth.uid(); aid uuid; v_source public.device_sources;
begin
  if actor is null or not private.is_staff() then raise exception 'staff access required'; end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'reason required'; end if;
  if p_entity_type='device' then
    select to_jsonb(d) into oldv from public.devices d where d.id=p_entity_id for update;
    if oldv is null then raise exception 'device not found'; end if;
    if p_verified then
      if p_source_id is null then raise exception 'an approved manufacturer source is required for device verification'; end if;
      select * into v_source from public.device_sources where id=p_source_id and device_id=p_entity_id for update;
      if not found then raise exception 'source not found for device'; end if;
      if v_source.review_status <> 'approved' or not coalesce(v_source.current,false) then raise exception 'source must be approved and current before device verification'; end if;
      if v_source.source_type not in ('manufacturer_ifu','manufacturer_web') then raise exception 'device verification requires a manufacturer source'; end if;
      if v_source.storage_path is null and v_source.source_url is null then raise exception 'approved source has no evidence attachment'; end if;
    end if;
    update public.devices set labeling_status=case when p_verified then 'verified' else 'unverified' end,labeling_verified_at=case when p_verified then now() else null end,manufacturer_verified_at=case when p_verified then now() else null end,verification_notes=coalesce(p_verification_notes,verification_notes),labeling_source_document_id=case when p_verified then p_source_id else labeling_source_document_id end,updated_at=now() where id=p_entity_id returning to_jsonb(devices) into newv;
  elsif p_entity_type='component' then
    select to_jsonb(c) into oldv from public.device_components c where c.id=p_entity_id for update;
    if oldv is null then raise exception 'component not found'; end if;
    update public.device_components set labeling_status=case when p_verified then 'verified' else 'unverified' end,labeling_verified_at=case when p_verified then now() else null end,verified_by=case when p_verified then p_verified_by else null end,verification_notes=coalesce(p_verification_notes,verification_notes),notes=coalesce(p_verification_notes,notes) where id=p_entity_id returning to_jsonb(device_components) into newv;
  else raise exception 'unsupported entity type'; end if;
  insert into public.catalog_verification_audit(actor_user_id,entity_type,entity_id,action,previous_value,new_value,reason) values(actor,p_entity_type,p_entity_id,case when p_verified then 'verify' else 'unverify' end,oldv,newv,p_reason) returning id into aid;
  return jsonb_build_object('ok',true,'entity_type',p_entity_type,'entity_id',p_entity_id,'verified',p_verified,'audit_id',aid);
end
$function$;
revoke execute on function public.quickcheck_staff_set_verification(text,uuid,boolean,text,uuid,text,text) from anon, public;
grant execute on function public.quickcheck_staff_set_verification(text,uuid,boolean,text,uuid,text,text) to authenticated;
