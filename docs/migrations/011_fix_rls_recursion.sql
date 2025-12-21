-- FIX RLS Recursion Bug
-- The recursive loop happens because 'sessions' policy checks 'session_participants', and 'session_participants' policy checks 'sessions'.
-- We break this by using a SECURITY DEFINER function to check session ownership, which bypasses RLS.

create or replace function public.get_session_owner(session_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select user_id from public.sessions where id = session_id;
$$;

-- Drop existing policies that cause recursion
drop policy "Users can view participants of their sessions." on public.session_participants;
drop policy "Owners and Editors can invite participants." on public.session_participants;
drop policy "Owners can remove participants." on public.session_participants;

-- Re-create policies using the secure function

-- 1. Users can view participants
create policy "Users can view participants of their sessions (Safe)."
  on public.session_participants for select
  using (
    (select auth.uid()) = user_id
    OR
    -- Check if I am a participant (recursion safe? no, this table queries itself? self-recursion is usually fine if optimized, but let's be safe)
    exists (
      select 1 from public.session_participants sp
      where sp.session_id = session_participants.session_id
      and sp.user_id = (select auth.uid())
    )
    OR
    -- Check if I am the owner (using function to bypass sessions RLS)
    (select public.get_session_owner(session_participants.session_id)) = (select auth.uid())
  );

-- 2. Owners and Editors can invite
create policy "Owners and Editors can invite participants (Safe)."
  on public.session_participants for insert
  with check (
    -- Owner check
    (select public.get_session_owner(session_id)) = (select auth.uid())
    OR
    -- Editor check
    exists (
      select 1 from public.session_participants sp
      where sp.session_id = session_id
      and sp.user_id = (select auth.uid())
      and sp.role in ('owner', 'editor')
    )
  );

-- 3. Owners can remove
create policy "Owners can remove participants (Safe)."
  on public.session_participants for delete
  using (
    -- Owner check
    (select public.get_session_owner(session_id)) = (select auth.uid())
    OR
    -- Self leave
    user_id = (select auth.uid())
  );
