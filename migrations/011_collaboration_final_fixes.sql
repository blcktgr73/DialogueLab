-- Consolidated Fixes for Collaboration Feature
-- Includes:
-- 1. RLS Infinite Recursion Fix (using Security Definer functions)
-- 2. Foreign Key Relationship Fix (auth.users -> public.profiles)
-- 3. Email Data Backfill & Trigger Fix

-- ==========================================
-- 1. Robust RLS Setup (Fix Infinite Recursion)
-- ==========================================

-- Drop all existing policies to ensure a clean slate
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN select policyname from pg_policies where tablename = 'session_participants' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.session_participants', pol.policyname);
    END LOOP;
END $$;

-- Create Helper Functions (Security Definer to bypass ALL RLS)

-- Check if user is the session owner
create or replace function public.get_session_owner(session_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select user_id from public.sessions where id = session_id;
$$;

-- Check if user is a participant
create or replace function public.is_participant(check_session_id uuid, check_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.session_participants
    where session_id = check_session_id
    and user_id = check_user_id
  );
$$;

-- Check if user can invite (Owner/Editor)
create or replace function public.can_manage_participants(check_session_id uuid, check_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select (
    -- Session Owner
    (select user_id from public.sessions where id = check_session_id) = check_user_id
    OR
    -- Editor or Owner role in participants
    exists (
      select 1 from public.session_participants
      where session_id = check_session_id
      and user_id = check_user_id
      and role in ('owner', 'editor')
    )
  );
$$;

-- Create FINAL Safe Policies

-- Users can view participants
create policy "Users can view participants safe"
  on public.session_participants for select
  using (
    user_id = (select auth.uid())
    OR
    public.is_participant(session_participants.session_id, (select auth.uid()))
    OR
    public.get_session_owner(session_participants.session_id) = (select auth.uid())
  );

-- Owners/Editors can invite
create policy "Owners/Editors can invite safe"
  on public.session_participants for insert
  with check (
    public.can_manage_participants(session_id, (select auth.uid()))
  );

-- Owners can remove
create policy "Owners can remove safe"
  on public.session_participants for delete
  using (
    public.get_session_owner(session_id) = (select auth.uid())
    OR
    user_id = (select auth.uid())
  );


-- ==========================================
-- 2. Fix Foreign Key Relationship
-- ==========================================

-- Drop the existing foreign key to auth.users (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_participants_user_id_fkey') THEN
    ALTER TABLE public.session_participants DROP CONSTRAINT session_participants_user_id_fkey;
  END IF;
END $$;

-- Add new foreign key to public.profiles
-- This allows the API to automatically join these tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_participants_user_id_fkey_profiles') THEN
      ALTER TABLE public.session_participants
      ADD CONSTRAINT session_participants_user_id_fkey_profiles
      FOREIGN KEY (user_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;


-- ==========================================
-- 3. Fix Email Trigger & Backfill
-- ==========================================

-- Update the Trigger Function (Ensure future signups capture email)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$ language plpgsql security definer;

-- Backfill Missing Emails (Fix existing users)
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
and (p.email is null or p.email = '');
