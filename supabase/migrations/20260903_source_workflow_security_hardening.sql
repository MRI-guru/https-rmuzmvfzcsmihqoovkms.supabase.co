-- Source workflow security hardening.
-- Keep staff RPCs inaccessible to anonymous/public callers and enforce source invariants.

revoke execute on function public.quickcheck_staff_add_source(uuid,text,text,text,text,text,text,text,bigint,text) from anon, public;
revoke execute on function public.quickcheck_staff_review_source(uuid,text,text) from anon, public;
revoke execute on function public.quickcheck_staff_set_verification(text,uuid,boolean,text,uuid,text,text) from anon, public;
grant execute on function public.quickcheck_staff_add_source(uuid,text,text,text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.quickcheck_staff_review_source(uuid,text,text) to authenticated;
grant execute on function public.quickcheck_staff_set_verification(text,uuid,boolean,text,uuid,text,text) to authenticated;

create or replace function public.quickcheck_staff_add_source(
  p_device_id uuid,
  p_source_type text,
  p_title text,
  p_source_url text default null,
  p_source_identifier text default null,
  p_notes text default null,
  p_storage_path text default null,
  p_content_type text default 'application/pdf',
  p_file_size bigint default null,
  p_document_hash text default null
)
returns public.device_sources
language plpgsql
security definer
set search_path = public, private
as $function$
declare v_row public.device_sources;
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'staff access required'; end if;
  if not exists (select 1 from public.devices d where d.id=p_device_id and d.active) then raise exception 'active device not found'; end if;
  if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'source title required'; end if;
  if p_source_type not in ('manufacturer_ifu','manufacturer_web','regulatory','other') then raise exception 'invalid source type'; end if;
  if p_content_type is distinct from 'application/pdf' then raise exception 'PDF documents only'; end if;
  if p_storage_path is not null and p_storage_path !~ ('^mri-source-documents/' || p_device_id::text || '/[^/]+\.pdf$') then raise exception 'invalid storage path'; end if;
  if p_source_url is not null and p_source_url !~* '^https://' then raise exception 'source URL must use HTTPS'; end if;
  if p_file_size is not null and (p_file_size <= 0 or p_file_size > 52428800) then raise exception 'invalid PDF file size'; end if;
  insert into public.device_sources(device_id,source_type,title,source_url,source_identifier,notes,current,review_status,storage_path,content_type,file_size,document_hash,source_authority)
  values(p_device_id,p_source_type,trim(p_title),p_source_url,p_source_identifier,p_notes,false,'pending',p_storage_path,p_content_type,p_file_size,p_document_hash,'manufacturer')
  returning * into v_row;
  return v_row;
end
$function$;

create or replace function public.quickcheck_staff_review_source(p_source_id uuid,p_review_status text,p_reason text)
returns public.device_sources
language plpgsql
security definer
set search_path = public, private
as $function$
declare v_old public.device_sources; v_row public.device_sources; v_reason text;
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'staff access required'; end if;
  v_reason := nullif(trim(coalesce(p_reason,'')),'');
  if v_reason is null or length(v_reason)<3 then raise exception 'review reason required'; end if;
  if p_review_status not in ('approved','rejected','retired','pending') then raise exception 'invalid review status'; end if;
  select * into v_old from public.device_sources where id=p_source_id for update;
  if not found then raise exception 'source not found'; end if;
  if p_review_status='approved' then
    if v_old.source_type not in ('manufacturer_ifu','manufacturer_web') then raise exception 'only manufacturer sources can be approved as current'; end if;
    if v_old.storage_path is null and v_old.source_url is null then raise exception 'approved source must have a PDF or HTTPS source URL'; end if;
    if v_old.source_url is not null and v_old.source_url !~* '^https://' then raise exception 'source URL must use HTTPS'; end if;
    if v_old.storage_path is not null and not exists (select 1 from storage.objects o where o.bucket_id='mri-source-documents' and o.name=v_old.storage_path) then raise exception 'attached PDF is missing from private storage'; end if;
    update public.device_sources set current=false where device_id=v_old.device_id and id<>p_source_id and current=true;
  end if;
  update public.device_sources set review_status=p_review_status,current=(p_review_status='approved'),reviewed_by=auth.uid(),reviewed_at=now(),verified_at=case when p_review_status='approved' then now() else verified_at end where id=p_source_id returning * into v_row;
  insert into public.catalog_verification_audit(actor_user_id,entity_type,entity_id,action,previous_value,new_value,reason) values(auth.uid(),'source',p_source_id,'review',to_jsonb(v_old),to_jsonb(v_row),v_reason);
  return v_row;
end
$function$;

revoke execute on function public.quickcheck_staff_add_source(uuid,text,text,text,text,text,text,text,bigint,text) from anon, public;
revoke execute on function public.quickcheck_staff_review_source(uuid,text,text) from anon, public;
grant execute on function public.quickcheck_staff_add_source(uuid,text,text,text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.quickcheck_staff_review_source(uuid,text,text) to authenticated;
