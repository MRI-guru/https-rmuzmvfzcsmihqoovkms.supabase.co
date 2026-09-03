-- Step 15 production regression checks.
-- Run with the Supabase test database or SQL editor after migrations are applied.

begin;

-- Required exact-system metadata exists for the verified single-chamber examples.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.device_systems ds
  where ds.status = 'current'
    and ds.system_type = 'single_chamber'
    and ds.required_lead_count = 1
    and ds.name in ('A3SR01 + 5076 (model-level verified)', 'W1SR01 + 5076 (model-level verified)');
  if v_count <> 2 then
    raise exception 'Expected two current verified single-chamber systems; found %', v_count;
  end if;
end $$;

-- Dual-chamber templates must require two leads and remain legacy until exact configurations are verified.
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from public.device_systems ds
  where ds.status = 'legacy'
    and ds.system_type = 'dual_chamber'
    and ds.required_lead_count <> 2;
  if v_bad <> 0 then
    raise exception 'A dual-chamber system has an invalid lead count';
  end if;
end $$;

-- Current systems must have explicit slot-level component links.
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from public.device_systems ds
  where ds.status = 'current'
    and ds.system_type = 'single_chamber'
    and not exists (select 1 from public.system_components sc where sc.system_id = ds.id and sc.slot = 'generator')
    and ds.name in ('A3SR01 + 5076 (model-level verified)', 'W1SR01 + 5076 (model-level verified)');
  if v_bad <> 0 then
    raise exception 'A verified current system is missing an explicit generator slot';
  end if;
end $$;

-- Boston SC-1216 must retain a current approved manufacturer source and a 1.5T-only condition.
do $$
declare
  v_device uuid;
  v_source uuid;
  v_conditions integer;
begin
  select id into v_device
  from public.devices
  where manufacturer_model_number = 'SC-1216'
    and active = true
  limit 1;
  if v_device is null then raise exception 'SC-1216 is missing'; end if;

  select id into v_source
  from public.device_sources
  where device_id = v_device
    and current = true
    and review_status = 'approved'
    and source_authority = 'manufacturer'
  limit 1;
  if v_source is null then raise exception 'SC-1216 is missing an approved current manufacturer source'; end if;

  select count(*) into v_conditions
  from public.device_conditions
  where device_id = v_device
    and active = true
    and 1.5 = any(allowed_field_strengths_t);
  if v_conditions < 1 then raise exception 'SC-1216 has no active 1.5T condition'; end if;

  if exists (
    select 1 from public.device_conditions
    where device_id = v_device
      and active = true
      and 3.0 = any(allowed_field_strengths_t)
  ) then
    raise exception 'SC-1216 incorrectly has an active 3T condition';
  end if;
end $$;

-- Component compatibility must not use the old status='active' convention.
do $$
begin
  if position('ds.status=''current''' in pg_get_functiondef('public.evaluate_scanner_compatibility_with_component(uuid,uuid,numeric,uuid,text)'::regprocedure)) = 0 then
    raise exception 'Component compatibility function is not using current system status';
  end if;
end $$;

rollback;
