-- ============================================================
-- 029_lms_auto_sync.sql
--
-- WHAT THIS FILE IS
--   Database side of the LMS -> Calendar auto-sync (edge function lms-sync).
--   Adds the column the sync uses to remember what LMS said last time, and
--   schedules the sync to run every 5 minutes.
--
-- WHY lms_snapshot
--   The sync only writes a field when LMS itself changed it since the last
--   run. Without remembering the last LMS values, every run would overwrite
--   what staff corrected by hand (VMDE, Jain menu, exact times...) with
--   LMS's rougher version.
--
-- BEFORE RUNNING
--   Deploy the lms-sync edge function with "Verify JWT" OFF. Nothing else:
--   the cron secret is generated here and lives in lms_sync_state, which
--   both the cron job and the function read (no dashboard secret needed).
-- ============================================================

alter table public.events add column if not exists lms_snapshot jsonb;

-- One-row run lock shared by the cron job and the "Sync Now" button, so two
-- runs never overlap (they would both insert the same new booking).
-- RLS on with no policies: only the edge function (service role) can touch it.
create table if not exists public.lms_sync_state (
  id               int primary key default 1 check (id = 1),
  last_started_at  timestamptz not null default 'epoch',
  last_finished_at timestamptz,
  last_result      jsonb,
  -- Proves a request came from the cron job (unlocks the dry-run report)
  cron_secret      text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
insert into public.lms_sync_state (id) values (1) on conflict do nothing;
alter table public.lms_sync_state enable row level security;

-- Claims the lock. Refuses while a run is in progress (a run older than
-- 3 minutes is treated as crashed) or when one finished < min_gap_seconds ago.
create or replace function public.lms_sync_claim(min_gap_seconds int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.lms_sync_state;
begin
  select * into s from public.lms_sync_state where id = 1 for update;
  if s.last_started_at > now() - interval '3 minutes'
     and (s.last_finished_at is null or s.last_finished_at < s.last_started_at) then
    return jsonb_build_object('ok', false, 'reason', 'running');
  end if;
  if s.last_finished_at > now() - make_interval(secs => min_gap_seconds) then
    return jsonb_build_object('ok', false, 'reason', 'recent', 'last_result', s.last_result);
  end if;
  update public.lms_sync_state set last_started_at = now() where id = 1;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.lms_sync_claim(int) from public, anon, authenticated;
grant execute on function public.lms_sync_claim(int) to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running this file replaces the schedule instead of adding a second one
select cron.unschedule('lms-sync') where exists (select 1 from cron.job where jobname = 'lms-sync');

select cron.schedule(
  'lms-sync',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://aqpaiyiriarnqhmnxtpt.supabase.co/functions/v1/lms-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select cron_secret from public.lms_sync_state where id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
