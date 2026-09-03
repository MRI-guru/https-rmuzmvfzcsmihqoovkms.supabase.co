import { supabase } from '@/lib/supabase';

export type SafetyStatus = 'safe' | 'conditional' | 'unsafe' | 'unknown';

export type QuickCheckItem = {
  id: string;
  model_name?: string | null;
  model_number?: string | null;
  manufacturer_name?: string | null;
  device_type?: string | null;
  [key: string]: unknown;
};

export type QuickCheckResult = {
  version?: string;
  check_id?: string;
  checked_at?: string;
  status: SafetyStatus;
  display_status: string;
  safe_to_scan: boolean;
  requires_review: boolean;
  decision?: string | null;
  device?: Record<string, unknown> | null;
  component?: Record<string, unknown> | null;
  scanner?: Record<string, unknown> | null;
  condition?: Record<string, unknown> | null;
  next_action?: string | null;
  [key: string]: unknown;
};

export async function searchDevices(search: string) {
  const { data, error } = await supabase.rpc('quickcheck_search_devices', { search });
  if (error) throw error;
  return (data ?? []) as QuickCheckItem[];
}

export async function searchComponents(deviceId: string, search = '') {
  const { data, error } = await supabase.rpc('quickcheck_search_components', {
    device_id: deviceId,
    search,
  });
  if (error) throw error;
  return (data ?? []) as QuickCheckItem[];
}

export async function searchScanners(manufacturerId?: string) {
  const { data, error } = await supabase.rpc('quickcheck_search_scanners', {
    manufacturer_id: manufacturerId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as QuickCheckItem[];
}

export async function getScannerOptions() {
  const { data, error } = await supabase.rpc('quickcheck_scanner_options');
  if (error) throw error;
  return (data ?? []) as QuickCheckItem[];
}

export async function runQuickCheck(input: {
  device_id: string;
  component_id?: string;
  scanner_model_id?: string;
  scanner_strength_t: number;
  scan_region: string;
}) {
  const { data, error } = await supabase.functions.invoke('quickcheck', {
    body: input,
  });
  if (error) throw error;
  return data as QuickCheckResult;
}
