-- Create session_participants table
create table public.session_participants (
  session_id uuid references public.sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('viewer', 'editor', 'owner')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (session_id, user_id)
);

-- Enable RLS
alter table public.session_participants enable row level security;

-- Policies for session_participants

-- 1. Users can view participants for sessions they are part of (or own)
create policy "Users can view participants of their sessions."
  on public.session_participants for select
  using (
    -- The user is a participant of this session
    (select auth.uid()) = user_id
    OR
    -- OR the user is a participant of the session related to this row (recursion is risky, so we check sessions table or existence)
    exists (
      select 1 from public.session_participants sp
      where sp.session_id = session_participants.session_id
      and sp.user_id = (select auth.uid())
    )
    OR
    -- OR the user owns the session (check sessions table)
    exists (
      select 1 from public.sessions s
      where s.id = session_participants.session_id
      and s.user_id = (select auth.uid())
    )
  );

-- 2. Owners and Editors can invite (insert) participants
create policy "Owners and Editors can invite participants."
  on public.session_participants for insert
  with check (
    -- User is the owner of the session
    exists (
      select 1 from public.sessions s
      where s.id = session_id
      and s.user_id = (select auth.uid())
    )
    OR
    -- User is an editor or owner participant
    exists (
      select 1 from public.session_participants sp
      where sp.session_id = session_id
      and sp.user_id = (select auth.uid())
      and sp.role in ('owner', 'editor')
    )
  );

-- 3. Owners can remove (delete) participants
create policy "Owners can remove participants."
  on public.session_participants for delete
  using (
    -- User is the owner of the session
    exists (
      select 1 from public.sessions s
      where s.id = session_participants.session_id
      and s.user_id = (select auth.uid())
    )
    OR
    -- User is the "owner" role in participants (if we use that for original owner too, but usually sessions.user_id is the super owner)
    exists (
      select 1 from public.session_participants sp
      where sp.session_id = session_participants.session_id
      and sp.user_id = (select auth.uid())
      and sp.role = 'owner'
    )
    OR
    -- User can remove THEMSELVES (Leave session)
    user_id = (select auth.uid())
  );

-- Update Sessions Table RLS to allow access to participants
-- We need to DROP existing policies or create a new comprehensive one.
-- Ideally, we modify the existing SELECT policy.

-- For now, let's assuming we keep the old one and ADD a new one for participants?
-- "Users can view own sessions" -> user_id = auth.uid()
-- New: "Participants can view shared sessions"

create policy "Participants can view shared sessions."
  on public.sessions for select
  using (
    exists (
      select 1 from public.session_participants sp
      where sp.session_id = id
      and sp.user_id = (select auth.uid())
    )
  );
  
-- Index for performance
create index idx_session_participants_user_id on public.session_participants(user_id);
create index idx_session_participants_session_id on public.session_participants(session_id);
