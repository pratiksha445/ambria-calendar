-- Add approval workflow columns to users table
alter table public.users
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists approved_by uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists requested_at timestamptz,
  add column if not exists rejection_reason text;

-- Mark the existing default admin as approved
update public.users
  set approval_status = 'approved',
      approved_at = now()
  where phone = '+91 8800276444'
    and approval_status = 'approved';

-- Index for filtering by approval status
create index if not exists idx_users_approval on public.users(approval_status);
