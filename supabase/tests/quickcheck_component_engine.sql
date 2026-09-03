-- MRI Safety QuickCheck component/system compatibility acceptance tests.
-- Run manually against a test/staging database or the connected project.
-- The temporary-state test uses BEGIN/ROLLBACK and must not leave catalog changes behind.

-- 1) Unverified exact component must never clear.
DO $$
DECLARE
  r jsonb;
BEGIN
  r := evaluate_scanner_compatibility_with_component(
    '2e25accd-c340-49b7-87ee-a93116cab4b1'::uuid,
    'f2ec2a09-7d03-4206-9dd6-7d55244ceaa0'::uuid,
    1.5,
    '01455092-2cb4-4f12-a6b0-0531991157ec'::uuid,
    'Full body'
  );
  IF r->>'status' <> 'unknown'
     OR r->>'display_status' <> 'VERIFY LEAD/COMPONENT'
     OR (r->>'safe_to_scan')::boolean IS TRUE
     OR (r->>'requires_review')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL unverified component gate: %', r;
  END IF;
END $$;

-- 2) A component belonging to another generator must never be accepted.
DO $$
DECLARE
  r jsonb;
BEGIN
  r := evaluate_scanner_compatibility_with_component(
    '07f0e559-164c-4142-ae31-34b6393ba8d8'::uuid,
    'f2ec2a09-7d03-4206-9dd6-7d55244ceaa0'::uuid,
    1.5,
    '01455092-2cb4-4f12-a6b0-0531991157ec'::uuid,
    'Full body'
  );
  IF r->>'status' <> 'unknown'
     OR (r->>'safe_to_scan')::boolean IS TRUE
     OR (r->>'requires_review')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL wrong-device component gate: %', r;
  END IF;
END $$;

-- 3) A verified component without an explicitly verified system must not clear.
BEGIN;
UPDATE device_components
SET labeling_status = 'verified',
    source_document_id = 'e6407bb6-2481-48ba-b70c-686857a50d6d'::uuid,
    source_verified_at = now()
WHERE id = 'f2ec2a09-7d03-4206-9dd6-7d55244ceaa0'::uuid;

DO $$
DECLARE
  r jsonb;
BEGIN
  r := evaluate_scanner_compatibility_with_component(
    '2e25accd-c340-49b7-87ee-a93116cab4b1'::uuid,
    'f2ec2a09-7d03-4206-9dd6-7d55244ceaa0'::uuid,
    1.5,
    '01455092-2cb4-4f12-a6b0-0531991157ec'::uuid,
    'Full body'
  );
  IF r->>'status' <> 'unknown'
     OR r->>'display_status' <> 'VERIFY SYSTEM'
     OR (r->>'safe_to_scan')::boolean IS TRUE
     OR (r->>'requires_review')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL system verification gate: %', r;
  END IF;
END $$;
ROLLBACK;

-- 4) Boston Scientific SC-1216: 3T must be rejected because its verified labeling is 1.5T only.
DO $$
DECLARE
  r jsonb;
BEGIN
  r := evaluate_scanner_compatibility(
    '33c939fa-480f-4a38-aee5-9acebab6572e'::uuid,
    3.0,
    '349add77-84f4-4680-ade8-df4698f5bf07'::uuid,
    'Full body'
  );
  IF r->>'status' <> 'unsafe'
     OR r->>'display_status' <> 'NOT SAFE FOR THIS SCANNER'
     OR (r->>'safe_to_scan')::boolean IS TRUE
     OR (r->>'requires_review')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL 3T mismatch gate: %', r;
  END IF;
END $$;

-- 5) Boston Scientific SC-1216 at 1.5T remains conditional, never automatic clearance.
DO $$
DECLARE
  r jsonb;
BEGIN
  r := evaluate_scanner_compatibility(
    '33c939fa-480f-4a38-aee5-9acebab6572e'::uuid,
    1.5,
    '01455092-2cb4-4f12-a6b0-0531991157ec'::uuid,
    'Full body'
  );
  IF r->>'status' <> 'conditional'
     OR (r->>'safe_to_scan')::boolean IS TRUE
     OR (r->>'requires_review')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL conditional safety gate: %', r;
  END IF;
END $$;

SELECT 'MRI Safety QuickCheck component engine acceptance tests passed' AS result;
