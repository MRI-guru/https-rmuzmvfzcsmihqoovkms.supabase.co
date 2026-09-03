-- Connect approved/current manufacturer source records to QuickCheck evidence.
-- This migration is intentionally conservative: QuickCheck returns UNKNOWN unless
-- the exact device has a verified label, an approved current manufacturer source,
-- and the matching condition points to the same underlying document.

alter table public.device_sources
  add column if not exists document_id uuid references public.documents(id);

-- Bridge the previously verified Boston Scientific manufacturer document into the
-- new source workflow without creating a false new clinical verification event.
do $$
declare r record; sid uuid;
begin
  for r in select id from public.devices where id in (
    '33c939fa-480f-4a38-aee5-9acebab6572e',
    '50363210-203f-4c39-90cc-652fa8341284',
    '20921da3-d4f6-4757-852b-9b3a8440c9c1',
    '2b5059f1-6876-44b2-bdf2-6b11843e4a92'
  ) loop
    select id into sid from public.device_sources
      where device_id=r.id
        and document_id='b947db46-f487-4d0f-a22b-b8c89ec1c1be';
    if sid is null then
      insert into public.device_sources(
        device_id,document_id,source_type,title,source_url,source_identifier,
        notes,current,review_status,verified_at,reviewed_at,source_authority,content_type
      ) values (
        r.id,'b947db46-f487-4d0f-a22b-b8c89ec1c1be','manufacturer',
        'ImageReady MRI Full Body Guidelines for WaveWriter Alpha and WaveWriter Alpha Prime Spinal Cord Stimulator Systems',
        'https://www.bostonscientific.com/content/dam/elabeling/nm/scs/96996099-02B_IMAGEREADY_MRI_WW_ALPHA_PRIME_IFU_ML_s.pdf',
        '96996099-02B Rev B',
        'Migrated from previously verified manufacturer labeling; confirm current labeling during routine source review.',
        true,'approved',now(),now(),'manufacturer','application/pdf'
      ) returning id into sid;
    end if;
    update public.device_sources set current=true,review_status='approved',source_authority='manufacturer' where id=sid;
    update public.device_sources set current=false where device_id=r.id and id<>sid;
  end loop;
end $$;

create or replace function public.quickcheck_staff_add_source(
  p_device_id uuid,p_source_type text,p_title text,p_source_url text default null,
  p_source_identifier text default null,p_notes text default null,p_storage_path text default null,
  p_content_type text default null,p_file_size bigint default null,p_document_hash text default null
) returns public.device_sources
language plpgsql security definer set search_path=public,private as $$
declare v_row public.device_sources; v_authority text;
begin
  if not private.is_staff() then raise exception 'staff access required'; end if;
  if p_source_type not in ('manufacturer','manufacturer_ifu','manufacturer_web','mrisafety','fda','acr','regulatory','other') then raise exception 'invalid source type'; end if;
  v_authority:=case when p_source_type in ('manufacturer','manufacturer_ifu','manufacturer_web') then 'manufacturer' when p_source_type='regulatory' then 'fda' else p_source_type end;
  if p_storage_path is not null then
    if p_content_type is distinct from 'application/pdf' then raise exception 'attached documents must be PDF'; end if;
    if p_storage_path not like 'mri-source-documents/%' then raise exception 'invalid storage path'; end if;
    if p_file_size is null or p_file_size<=0 or p_file_size>52428800 then raise exception 'invalid PDF file size'; end if;
  elsif p_source_url is null or p_source_url !~* '^https://' then
    raise exception 'HTTPS source URL required when no PDF is attached';
  end if;
  insert into public.device_sources(device_id,source_type,title,source_url,source_identifier,notes,current,review_status,storage_path,content_type,file_size,document_hash,source_authority)
  values(p_device_id,p_source_type,p_title,p_source_url,p_source_identifier,p_notes,false,'pending',p_storage_path,case when p_storage_path is not null then 'application/pdf' else null end,p_file_size,p_document_hash,v_authority)
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.evaluate_scanner_compatibility(
  p_device_id uuid,p_scanner_strength_t numeric,p_scanner_model_id uuid default null,p_scan_region text default null
) returns jsonb language plpgsql stable set search_path=public as $$
declare v_device record; v_condition record; v_source record; v_status text; v_candidate_count integer:=0; v_requested_region text:=lower(trim(coalesce(p_scan_region,''))); v_condition_region text;
begin
  if p_device_id is null or p_scanner_strength_t is null or p_scanner_strength_t<=0 then return jsonb_build_object('status','unknown','display_status','UNKNOWN','safe_to_scan',false,'requires_review',true,'reason','Device and a valid scanner field strength are required.'); end if;
  select d.id,d.model,d.family,d.device_type,d.mr_status,d.labeling_status,d.active,d.manufacturer_model_number,m.name as manufacturer into v_device from public.devices d left join public.manufacturers m on m.id=d.manufacturer_id where d.id=p_device_id;
  if not found or not v_device.active then return jsonb_build_object('status','unknown','display_status','UNKNOWN','safe_to_scan',false,'requires_review',true,'reason','Device was not found or is inactive.'); end if;
  if v_device.mr_status='unsafe' then return jsonb_build_object('status','unsafe','display_status','NOT SAFE','safe_to_scan',false,'requires_review',false,'device',jsonb_build_object('id',v_device.id,'manufacturer',v_device.manufacturer,'model',v_device.model),'reason','The device is labeled MR Unsafe.'); end if;
  select * into v_source from public.device_sources s where s.device_id=p_device_id and s.current=true and s.review_status='approved' and s.source_authority='manufacturer' order by s.verified_at desc nulls last,s.created_at desc limit 1;
  if not found or v_device.labeling_status<>'verified' then return jsonb_build_object('status','unknown','display_status','VERIFY LABELING','safe_to_scan',false,'requires_review',true,'device',jsonb_build_object('id',v_device.id,'manufacturer',v_device.manufacturer,'model',v_device.model),'reason','The exact device does not have an approved current manufacturer source in the source workflow.'); end if;
  for v_condition in select dc.*,sm.model as scanner_model,sm.field_strength_t as scanner_model_strength from public.device_conditions dc left join public.scanner_models sm on sm.id=dc.scanner_model_id where dc.device_id=p_device_id and dc.active order by (dc.scanner_model_id is not null) desc,(coalesce(array_length(dc.allowed_field_strengths_t,1),0)>0) desc,dc.verified_at desc nulls last,dc.created_at desc loop
    v_candidate_count:=v_candidate_count+1;
    if (v_condition.scanner_model_id is null or v_condition.scanner_model_id=p_scanner_model_id) and (v_condition.scan_region is null or p_scan_region is null or lower(trim(v_condition.scan_region))=v_requested_region or (v_requested_region='full body' and lower(trim(v_condition.scan_region)) like 'full body%') or (v_requested_region like 'full body%' and lower(trim(v_condition.scan_region))='full body')) and (coalesce(array_length(v_condition.allowed_field_strengths_t,1),0)=0 or p_scanner_strength_t=any(v_condition.allowed_field_strengths_t)) then
      if v_condition.verified_at is null or v_condition.source_document_id is distinct from v_source.document_id then return jsonb_build_object('status','unknown','display_status','VERIFY LABELING','safe_to_scan',false,'requires_review',true,'reason','A matching condition exists, but it is not linked to the approved current manufacturer source.'); end if;
      v_status=case when v_condition.compatibility_status in ('safe','conditional','unsafe') then v_condition.compatibility_status else 'unknown' end;
      return jsonb_build_object('status',v_status,'display_status',case v_status when 'safe' then 'SAFE' when 'conditional' then 'CONDITIONAL' when 'unsafe' then 'NOT SAFE' else 'UNKNOWN' end,'safe_to_scan',v_status='safe','requires_review',v_status<>'safe','device',jsonb_build_object('id',v_device.id,'manufacturer',v_device.manufacturer,'model',v_device.model,'manufacturer_model_number',v_device.manufacturer_model_number),'scanner',jsonb_build_object('model_id',p_scanner_model_id,'strength_t',p_scanner_strength_t,'scan_region',p_scan_region),'condition',to_jsonb(v_condition),'source',jsonb_build_object('id',v_source.id,'document_id',v_source.document_id,'title',v_source.title,'source_url',v_source.source_url,'review_status',v_source.review_status,'current',v_source.current,'source_authority',v_source.source_authority,'verified_at',v_source.verified_at),'reason',coalesce(v_condition.status_notes,'Matched verified device-specific MRI labeling condition.'));
    end if;
  end loop;
  return jsonb_build_object('status',case when v_candidate_count=0 then 'unknown' else 'unsafe' end,'display_status',case when v_candidate_count=0 then 'UNKNOWN' else 'NOT SAFE FOR THIS SCANNER' end,'safe_to_scan',false,'requires_review',true,'device',jsonb_build_object('id',v_device.id,'manufacturer',v_device.manufacturer,'model',v_device.model),'scanner',jsonb_build_object('model_id',p_scanner_model_id,'strength_t',p_scanner_strength_t,'scan_region',p_scan_region),'reason',case when v_candidate_count=0 then 'No active device-specific MRI conditions are recorded. Do not infer compatibility from the device family alone.' else format('No verified labeling condition matches the selected %s T scanner and requested scan region.',p_scanner_strength_t) end);
end $$;