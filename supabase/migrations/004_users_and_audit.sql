-- Users table for phone + PIN authentication
create table if not exists public.users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null unique,
  pin        text not null,
  role       text not null default 'staff' check (role in ('admin', 'manager', 'staff')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.users_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.users_set_updated_at();

-- Audit log table
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  user_name   text,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index idx_audit_created on public.audit_log(created_at desc);
create index idx_audit_user    on public.audit_log(user_id);
create index idx_audit_action  on public.audit_log(action);
create index idx_audit_entity  on public.audit_log(entity_type);

-- RLS — open policies matching existing pattern
alter table public.users enable row level security;
alter table public.audit_log enable row level security;

create policy "users_anon_select" on public.users for select to anon using (true);
create policy "users_anon_insert" on public.users for insert to anon with check (true);
create policy "users_anon_update" on public.users for update to anon using (true);
create policy "users_anon_delete" on public.users for delete to anon using (true);

create policy "audit_anon_select" on public.audit_log for select to anon using (true);
create policy "audit_anon_insert" on public.audit_log for insert to anon with check (true);

-- Default admin user
insert into public.users (name, phone, pin, role)
values ('Admin', '+91 8800276444', '2313', 'admin')
on conflict (phone) do nothing;
