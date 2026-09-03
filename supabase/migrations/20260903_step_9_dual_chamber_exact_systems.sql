-- Step 9: explicit dual-chamber system modeling and slot-aware exact verification.
-- This migration does NOT mark any new component or dual-chamber system as verified.
-- Current Medtronic labeling states that a complete dual-chamber SureScan pacemaker
-- system consists of the SureScan device and two SureScan pacing leads.

alter table public.device_systems
  add column if not exists system_type text not null default 'single_chamber',
  add column if not exists required_lead_count integer not null default 1;

alter table public.device_systems drop constraint if exists device_systems_system_type_check;
alter table public.device_systems add constraint device_systems_system_type_check
  check (system_type in ('single_chamber','dual_chamber','crt','icd','other'));

alter table public.device_systems drop constraint if exists device_systems_required_lead_count_check;
alter table public.device_systems add constraint device_systems_required_lead_count_check
  check (required_lead_count >= 0 and required_lead_count <= 8);

alter table public.system_components add column if not exists slot text;
with ranked as (
  select sc.system_id, sc.component_id,
         row_number() over(partition by sc.system_id order by sc.component_id) rn
  from public.system_components sc
  join public.device_components dc on dc.id=sc.component_id
)
update public.system_components sc
set slot=case
  when lower(coalesce(dc.component_type,'')) in ('generator','ipg','pulse_generator','device') then 'generator'
  else 'lead_' || r.rn
end
from ranked r
join public.device_components dc on dc.id=r.component_id
where sc.system_id=r.system_id and sc.component_id=r.component_id and sc.slot is null;

update public.system_components set slot='component_' || component_id::text where slot is null;
alter table public.system_components alter column slot set not null;
alter table public.system_components drop constraint if exists system_components_pkey;
alter table public.system_components add constraint system_components_pkey primary key (system_id,slot);
create unique index if not exists system_components_system_component_slot_uidx
  on public.system_components(system_id,component_id,slot);

update public.device_systems set system_type='single_chamber',required_lead_count=1
where device_id in (select id from public.devices where manufacturer_model_number in ('A3SR01','W1SR01'))
  and status='current';

do $$
declare v_manufacturer uuid; v_device record;
begin
  select id into v_manufacturer from public.manufacturers where lower(name)='medtronic' limit 1;
  if v_manufacturer is null then raise exception 'Medtronic manufacturer not found'; end if;
  for v_device in select id,manufacturer_model_number from public.devices
    where manufacturer_id=v_manufacturer and active=true and manufacturer_model_number in ('A2DR01','W1DR01') loop
    if not exists(select 1 from public.device_systems ds where ds.device_id=v_device.id
      and ds.system_type='dual_chamber' and ds.required_lead_count=2 and ds.status in ('legacy','current')) then
      insert into public.device_systems(device_id,name,status,notes,system_type,required_lead_count)
      values(v_device.id,v_device.manufacturer_model_number || ' complete dual-chamber SureScan system','legacy',
        'Verification template based on current Medtronic manufacturer labeling: a complete dual-chamber SureScan pacing system requires the SureScan device and two SureScan pacing leads. Exact implanted lead models/lengths and all current MRI conditions must be verified before changing this system to CURRENT.',
        'dual_chamber',2);
    end if;
  end loop;
end $$;

create or replace function public.quickcheck_staff_verify_system_v2(
  p_system_id uuid,p_components jsonb,p_source_id uuid,p_reason text,p_notes text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare sys record; src record; item jsonb; v_slot text; v_component_id uuid;
  v_generator_count int:=0; v_lead_count int:=0; audit_id uuid;
begin
  if not private.is_staff() then raise exception 'Staff access required'; end if;
  if coalesce(jsonb_typeof(p_components),'null')<>'array' then raise exception 'Components must be a JSON array'; end if;
  if jsonb_array_length(p_components)<2 then raise exception 'Complete system requires generator plus required lead components'; end if;
  if coalesce(length(trim(p_reason)),0)<3 then raise exception 'Verification reason is required'; end if;
  select ds.* into sys from public.device_systems ds where ds.id=p_system_id and ds.status in ('legacy','current');
  if not found then raise exception 'Device system template not found'; end if;
  select ds.* into src from public.device_sources ds where ds.id=p_source_id and ds.device_id=sys.device_id
    and ds.current=true and ds.review_status='approved' and ds.source_authority='manufacturer';
  if not found then raise exception 'Approved current manufacturer source required'; end if;
  if (select count(*) from jsonb_array_elements(p_components))<>(select count(distinct value->>'slot') from jsonb_array_elements(p_components)) then
    raise exception 'Each component must have a unique slot'; end if;
  for item in select value from jsonb_array_elements(p_components) loop
    v_slot:=nullif(trim(item->>'slot'),''); v_component_id:=nullif(item->>'component_id','')::uuid;
    if v_slot is null or v_component_id is null then raise exception 'Every component requires slot and component_id'; end if;
    if not exists(select 1 from public.device_components c where c.id=v_component_id and c.device_id=sys.device_id
      and c.active=true and c.labeling_status='verified' and c.source_document_id=src.document_id) then
      raise exception 'Every selected component must be verified against the selected current manufacturer source'; end if;
    if exists(select 1 from public.device_components c where c.id=v_component_id
      and lower(coalesce(c.component_type,'')) in ('generator','ipg','pulse_generator','device')) then
      v_generator_count:=v_generator_count+1;
    elsif exists(select 1 from public.device_components c where c.id=v_component_id
      and lower(coalesce(c.component_type,'')) in ('lead','leads')) then v_lead_count:=v_lead_count+1; end if;
  end loop;
  if v_generator_count<>1 then raise exception 'Exact system must contain exactly one generator/device component'; end if;
  if v_lead_count<>sys.required_lead_count then raise exception 'Exact system requires % pacing lead component(s)',sys.required_lead_count; end if;
  delete from public.system_components where system_id=p_system_id;
  for item in select value from jsonb_array_elements(p_components) loop
    insert into public.system_components(system_id,component_id,slot)
      values(p_system_id,(item->>'component_id')::uuid,trim(item->>'slot'));
  end loop;
  update public.device_systems set status='current',notes=coalesce(p_notes,'Explicitly verified exact implanted system against current manufacturer labeling.') where id=p_system_id;
  insert into public.catalog_verification_audit(entity_type,entity_id,action,reason,metadata)
    values('device_system',p_system_id,'verify',p_reason,jsonb_build_object('source_id',p_source_id,'document_id',src.document_id,
      'components',p_components,'complete_system',true,'system_type',sys.system_type,'required_lead_count',sys.required_lead_count)) returning id into audit_id;
  return jsonb_build_object('system_id',p_system_id,'device_id',sys.device_id,'source_id',p_source_id,'document_id',src.document_id,
    'components',p_components,'complete_system',true,'audit_id',audit_id);
end; $$;

revoke all on function public.quickcheck_staff_verify_system_v2(uuid,jsonb,uuid,text,text) from public,anon;
grant execute on function public.quickcheck_staff_verify_system_v2(uuid,jsonb,uuid,text,text) to authenticated;

create or replace function public.quickcheck_run_exact_system_check_v2(
  p_device_id uuid,p_components jsonb,p_scanner_model_id uuid,p_scanner_strength_t numeric,p_scan_region text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_system_id uuid; v_result jsonb; v_item jsonb; v_component_id uuid;
  v_component_result jsonb; v_components jsonb:='[]'::jsonb; v_first_component uuid;
  v_has_unknown boolean:=false; v_has_unsafe boolean:=false; v_has_conditional boolean:=false; v_status text:='safe'; v_scan_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_device_id is null or p_scanner_model_id is null or p_scanner_strength_t is null or p_scan_region is null then raise exception 'Device, scanner, field strength, and scan region are required'; end if;
  if coalesce(jsonb_typeof(p_components),'null')<>'array' or jsonb_array_length(p_components)=0 then raise exception 'At least one exact component is required'; end if;
  select ds.id into v_system_id from public.device_systems ds where ds.device_id=p_device_id and ds.status='current'
    and (select count(*) from public.system_components sc where sc.system_id=ds.id)=(select count(*) from jsonb_array_elements(p_components))
    and not exists(select 1 from public.system_components sc where sc.system_id=ds.id and not exists(select 1 from jsonb_array_elements(p_components) x
      where trim(x->>'slot')=sc.slot and (x->>'component_id')::uuid=sc.component_id))
    and not exists(select 1 from jsonb_array_elements(p_components) x where not exists(select 1 from public.system_components sc
      where sc.system_id=ds.id and sc.slot=trim(x->>'slot') and sc.component_id=(x->>'component_id')::uuid))
    order by ds.created_at desc limit 1;
  if v_system_id is null then return jsonb_build_object('status','unknown','display_status','VERIFY SYSTEM','safe_to_scan',false,'requires_review',true,
    'decision','The exact generator/lead system combination has not been explicitly verified.','next_action','Do not scan. Select every implanted component and have staff verify the complete exact system against current manufacturer labeling.',
    'device',(select to_jsonb(d) from public.devices d where d.id=p_device_id),'scanner',(select to_jsonb(sm) from public.scanner_models sm where sm.id=p_scanner_model_id),'component_slots',p_components); end if;
  for v_item in select value from jsonb_array_elements(p_components) loop
    v_component_id:=(v_item->>'component_id')::uuid; if v_first_component is null then v_first_component:=v_component_id; end if;
    if not exists(select 1 from public.device_components c where c.id=v_component_id and c.device_id=p_device_id and c.active=true and c.labeling_status='verified') then
      return jsonb_build_object('status','unknown','display_status','VERIFY LEAD/COMPONENT','safe_to_scan',false,'requires_review',true,
        'decision','One or more selected components are not verified against the current manufacturer source.','next_action','Do not scan. Verify every exact component against current manufacturer labeling.',
        'device',(select to_jsonb(d) from public.devices d where d.id=p_device_id),'scanner',(select to_jsonb(sm) from public.scanner_models sm where sm.id=p_scanner_model_id),'component_slots',p_components); end if;
    v_component_result:=public.evaluate_scanner_compatibility_with_component(p_device_id,v_component_id,p_scanner_strength_t,p_scanner_model_id,p_scan_region);
    v_components:=v_components||jsonb_build_array(jsonb_build_object('slot',trim(v_item->>'slot'),'component',coalesce(v_component_result->'component',(select to_jsonb(c) from public.device_components c where c.id=v_component_id)),'result',v_component_result));
    if v_component_result->>'status'='unknown' then v_has_unknown:=true; elsif v_component_result->>'status'='unsafe' then v_has_unsafe:=true; elsif v_component_result->>'status'='conditional' then v_has_conditional:=true; end if;
  end loop;
  if v_has_unknown then v_status:='unknown'; elsif v_has_unsafe then v_status:='unsafe'; elsif v_has_conditional then v_status:='conditional'; end if;
  v_result:=jsonb_build_object('status',v_status,'safe_to_scan',v_status='safe','requires_review',v_status<>'safe','system_id',v_system_id,
    'component_slots',p_components,'components',v_components,'device',(select to_jsonb(d) from public.devices d where d.id=p_device_id),
    'scanner',(select to_jsonb(sm) from public.scanner_models sm where sm.id=p_scanner_model_id),
    'next_action',case when v_status='safe' then 'Proceed only within the verified manufacturer labeling and facility MRI safety workflow.' when v_status='conditional' then 'Review and satisfy every applicable manufacturer condition before scanning. This is not clearance by itself.' when v_status='unsafe' then 'Do not scan. Resolve the incompatibility using current manufacturer labeling and MRI safety procedures.' else 'Do not scan. Verify the exact system and current manufacturer labeling.' end);
  insert into public.scanner_checks(user_id,device_id,scanner_model_id,scanner_strength_t,scan_region,result,component_id)
    values(v_user_id,p_device_id,p_scanner_model_id,p_scanner_strength_t,p_scan_region,v_result,v_first_component) returning id into v_scan_id;
  return v_result||jsonb_build_object('check_id',v_scan_id,'checked_at',now());
end; $$;

revoke all on function public.quickcheck_run_exact_system_check_v2(uuid,jsonb,uuid,numeric,text) from public,anon;
grant execute on function public.quickcheck_run_exact_system_check_v2(uuid,jsonb,uuid,numeric,text) to authenticated;

create or replace function public.quickcheck_get_system_requirements(p_device_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',ds.id,'name',ds.name,'status',ds.status,'system_type',ds.system_type,
    'required_lead_count',ds.required_lead_count,'notes',ds.notes) order by ds.status desc,ds.created_at desc),'[]'::jsonb)
  from public.device_systems ds where ds.device_id=p_device_id and ds.status in ('legacy','current');
$$;
revoke all on function public.quickcheck_get_system_requirements(uuid) from public,anon;
grant execute on function public.quickcheck_get_system_requirements(uuid) to authenticated;
