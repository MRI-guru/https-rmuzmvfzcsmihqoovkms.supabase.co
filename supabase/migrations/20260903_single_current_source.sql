create unique index if not exists device_sources_one_current_per_device on public.device_sources(device_id) where current=true;
