alter table public.device_sources add column if not exists review_status text not null default 'pending' check (review_status in ('pending','approved','rejected','retired'));
alter table public.device_sources add column if not exists reviewed_by uuid references auth.users(id);
alter table public.device_sources add column if not exists reviewed_at timestamptz;
alter table public.device_sources add column if not exists storage_path text;
alter table public.device_sources add column if not exists content_type text;
alter table public.device_sources add column if not exists file_size bigint;
alter table public.device_sources add column if not exists document_hash text;
alter table public.device_sources add column if not exists source_authority text;

update public.device_sources
set review_status = case when current then 'approved' else 'pending' end
where review_status is null or review_status = 'pending';

create unique index if not exists device_sources_storage_path_uidx
on public.device_sources(storage_path) where storage_path is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('mri-source-documents','mri-source-documents',false,52428800,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=52428800,allowed_mime_types=array['application/pdf'];

drop policy if exists mri_source_documents_staff_select on storage.objects;
drop policy if exists mri_source_documents_staff_insert on storage.objects;
drop policy if exists mri_source_documents_staff_update on storage.objects;
drop policy if exists mri_source_documents_staff_delete on storage.objects;

create policy mri_source_documents_staff_select on storage.objects
for select to authenticated
using (bucket_id='mri-source-documents' and private.is_staff());

create policy mri_source_documents_staff_insert on storage.objects
for insert to authenticated
with check (bucket_id='mri-source-documents' and private.is_staff() and storage.extension(name)='pdf');

create policy mri_source_documents_staff_update on storage.objects
for update to authenticated
using (bucket_id='mri-source-documents' and private.is_staff())
with check (bucket_id='mri-source-documents' and private.is_staff() and storage.extension(name)='pdf');

create policy mri_source_documents_staff_delete on storage.objects
for delete to authenticated
using (bucket_id='mri-source-documents' and private.is_staff());

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
) returns public.device_sources
language plpgsql security definer set search_path=public,private
as $$
declare v_row public.device_sources;
begin
  if not private.is_staff() then raise exception 'staff access required'; end if;
  if p_content_type is distinct from 'application/pdf' then raise exception 'PDF documents only'; end if;
  if p_storage_path is not null and p_storage_path not like 'mri-source-documents/%' then raise exception 'invalid storage path'; end if;
  insert into public.device_sources(device_id,source_type,title,source_url,source_identifier,notes,current,review_status,storage_path,content_type,file_size,document_hash,source_authority)
  values(p_device_id,p_source_type,p_title,p_source_url,p_source_identifier,p_notes,false,'pending',p_storage_path,p_content_type,p_file_size,p_document_hash,case when p_source_type='regulatory' then 'regulatory' else 'manufacturer' end)
  returning * into v_row;
  return v_row;
end $$;
revoke all on function public.quickcheck_staff_add_source(uuid,text,text,text,text,text,text,text,bigint,text) from public;
grant execute on function public.quickcheck_staff_add_source(uuid,text,text,text,text,text,text,text,bigint,text) to authenticated;

create or replace function public.quickcheck_staff_review_source(p_source_id uuid,p_review_status text,p_reason text)
returns public.device_sources
language plpgsql security definer set search_path=public,private
as $$
declare v_old public.device_sources; v_row public.device_sources;
begin
  if not private.is_staff() then raise exception 'staff access required'; end if;
  if p_review_status not in ('approved','rejected','retired','pending') then raise exception 'invalid review status'; end if;
  select * into v_old from public.device_sources where id=p_source_id for update;
  if not found then raise exception 'source not found'; end if;
  if p_review_status='approved' then
    update public.device_sources set current=false where device_id=v_old.device_id and id<>p_source_id and current=true;
  end if;
  update public.device_sources
  set review_status=p_review_status,current=(p_review_status='approved'),reviewed_by=auth.uid(),reviewed_at=now(),verified_at=case when p_review_status='approved' then now() else verified_at end
  where id=p_source_id returning * into v_row;
  insert into public.catalog_verification_audit(actor_user_id,entity_type,entity_id,action,previous_value,new_value,reason)
  values(auth.uid(),'source',p_source_id,'review',to_jsonb(v_old),to_jsonb(v_row),coalesce(nullif(trim(p_reason),''),'source review'));
  return v_row;
end $$;
revoke all on function public.quickcheck_staff_review_source(uuid,text,text) from public;
grant execute on function public.quickcheck_staff_review_source(uuid,text,text) to authenticated;
