-- Step 6: complete the seeded Medtronic exact component catalog.
-- Manufacturer evidence: Medtronic MR Conditional Search Tool.
-- IMPORTANT: cataloging a component does NOT verify it. Components remain unverified
-- until staff explicitly verifies the component and complete implanted system.

DO $$
DECLARE
  v_manufacturer uuid;
  v_source_document uuid := '89e20c5f-1161-4958-b0d7-63e5e74e3333';
  v_device record;
BEGIN
  SELECT id INTO v_manufacturer FROM public.manufacturers
  WHERE lower(name)='medtronic' LIMIT 1;
  IF v_manufacturer IS NULL THEN RAISE EXCEPTION 'Medtronic manufacturer not found'; END IF;

  FOR v_device IN
    SELECT id, model, manufacturer_model_number
    FROM public.devices
    WHERE manufacturer_id=v_manufacturer AND active=true
      AND manufacturer_model_number IN ('A2DR01','A3SR01','W1DR01','W1SR01')
  LOOP
    INSERT INTO public.device_sources(
      device_id,source_type,title,source_url,source_identifier,verified_at,current,
      notes,review_status,storage_path,content_type,source_authority,document_id)
    VALUES (
      v_device.id,'manufacturer',
      'Medtronic SureScan MRI labeling — MR Conditional Search Tool',
      'https://www.medtronic.com/en-us/healthcare-professionals/mri-resources/mr-conditional-search-tool.html',
      'MR Conditional Search Tool',now(),true,
      'Current manufacturer labeling reviewed 2026-09-03. Exact generator/lead combination and applicable patient/scanner conditions must still be confirmed.',
      'approved',null,'text/html','manufacturer',v_source_document)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.device_components(
      device_id,component_type,manufacturer_id,model,aliases,notes,active,labeling_status)
    SELECT v_device.id,'generator',v_manufacturer,v_device.manufacturer_model_number,
      ARRAY[v_device.model],
      'Exact generator component. Must be verified as part of the complete implanted system; do not infer system clearance from generator labeling alone.',
      true,'unverified'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.device_components c
      WHERE c.device_id=v_device.id AND c.active
        AND c.component_type='generator' AND c.model=v_device.manufacturer_model_number);

    INSERT INTO public.device_components(
      device_id,component_type,manufacturer_id,model,aliases,notes,active,labeling_status)
    SELECT v_device.id,'lead',v_manufacturer,x.model,x.aliases,
      'Manufacturer-listed pacing lead. Exact model, length, generator, implant configuration, and current MRI labeling must be confirmed before system verification.',
      true,'unverified'
    FROM (VALUES
      ('3830',ARRAY['SelectSecure MRI SureScan 3830']::text[]),
      ('4076',ARRAY['CapSureFix Novus MRI SureScan 4076']::text[]),
      ('5076',ARRAY['CapSureFix Novus MRI SureScan 5076']::text[]),
      ('4074',ARRAY['CapSure Sense MRI SureScan 4074']::text[]),
      ('4574',ARRAY['CapSure Sense MRI SureScan 4574']::text[]),
      ('5086MRI',ARRAY['5086MRI SureScan pacing lead']::text[])
    ) x(model,aliases)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.device_components c
      WHERE c.device_id=v_device.id AND c.active
        AND c.component_type='lead' AND c.model=x.model);
  END LOOP;
END $$;
