-- ============================================================
-- 028_signup_token.sql
--
-- WHAT THIS FILE IS
--   Database side of the "Request Access -> wait for approval -> set PIN"
--   flow. A new user no longer gets a guessable default PIN (0000). Instead
--   the device that sent the request keeps a random secret token, and only
--   that device can set the first PIN once an admin approves.
--
-- WHY IT EXISTS
--   With a default 0000 PIN, anyone who knew an approved person's phone
--   number could log in as them before they set their own PIN. The token
--   closes that gap. Only a SHA-256 hash of the token is stored, so reading
--   the users table does not reveal it.
--
--   The two functions are SECURITY DEFINER on purpose: a waiting user is not
--   logged in, and once RLS is tightened (security plan step 6) they will not
--   be able to read public.users directly. These functions keep this flow
--   working after that lockdown.
--
-- USED BY
--   src/lib/users.js  -> getSignupStatus(), completeSignup(), requestAccess()
--
-- DEPENDS ON
--   pgcrypto (enabled by default on Supabase, lives in the `extensions` schema)
--
-- SAFE TO RE-RUN: yes (if not exists / create or replace).
-- ============================================================

alter table public.users
  add column if not exists signup_token_hash text;

-- ------------------------------------------------------------
-- get_signup_status(phone, token)
--   Returns one row: status + name + rejection_reason.
--   status: 'pending' | 'approved' | 'rejected' | 'deactivated'
--         | 'not_found'     (row deleted by admin)
--         | 'token_invalid' (PIN already set, or token does not match)
-- ------------------------------------------------------------
create or replace function public.get_signup_status(p_phone text, p_token text)
returns table (status text, name text, rejection_reason text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.users%rowtype;
begin
  select * into r from public.users u where u.phone = p_phone;

  if not found then
    return query select 'not_found'::text, null::text, null::text;
    return;
  end if;

  if r.signup_token_hash is null
     or r.signup_token_hash <> encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') then
    return query select 'token_invalid'::text, null::text, null::text;
    return;
  end if;

  if r.approval_status = 'rejected' then
    return query select 'rejected'::text, r.name, r.rejection_reason;
  elsif r.approval_status = 'pending' then
    return query select 'pending'::text, r.name, null::text;
  elsif not r.is_active then
    return query select 'deactivated'::text, r.name, null::text;
  else
    return query select 'approved'::text, r.name, null::text;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- complete_signup(phone, token, pin)
--   Sets the first PIN for an approved user and burns the token so it
--   cannot be used again.
--   Returns: 'ok' | 'invalid_pin' | 'token_invalid' | 'not_approved'
-- ------------------------------------------------------------
create or replace function public.complete_signup(p_phone text, p_token text, p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.users%rowtype;
begin
  if p_pin is null or p_pin !~ '^\d{4}$' or p_pin = '0000' then
    return 'invalid_pin';
  end if;

  -- `for update` locks the row so two taps on "Set PIN" cannot race.
  select * into r from public.users u where u.phone = p_phone for update;

  if not found
     or r.signup_token_hash is null
     or r.signup_token_hash <> encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') then
    return 'token_invalid';
  end if;

  if r.approval_status <> 'approved' or not r.is_active then
    return 'not_approved';
  end if;

  update public.users
     set pin = p_pin,
         signup_token_hash = null
   where id = r.id;

  return 'ok';
end;
$$;

grant execute on function public.get_signup_status(text, text) to anon, authenticated;
grant execute on function public.complete_signup(text, text, text) to anon, authenticated;
