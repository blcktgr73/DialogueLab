-- Secure RLS Policies

-- 1. Sessions Table
-- Existing policy was for anonymous. Drop it.
drop policy if exists "Enable insert for anonymous users" on sessions;
drop policy if exists "Enable select for anonymous users" on sessions;

-- Create secure policies
create policy "Users can only create their own sessions"
on sessions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can only view their own sessions"
on sessions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can only delete their own sessions"
on sessions for delete
to authenticated
using (auth.uid() = user_id);

-- 2. Transcripts Table
-- Need to ensure access depends on session ownership
drop policy if exists "Enable insert for anonymous users" on transcripts;
drop policy if exists "Enable select for anonymous users" on transcripts;

create policy "Users can add transcripts to their own sessions"
on transcripts for insert
to authenticated
with check (
  exists (
    select 1 from sessions
    where id = transcripts.session_id
    and user_id = auth.uid()
  )
);

create policy "Users can view transcripts of their own sessions"
on transcripts for select
to authenticated
using (
  exists (
    select 1 from sessions
    where id = transcripts.session_id
    and user_id = auth.uid()
  )
);

-- 3. Analysis Results Table
drop policy if exists "Enable insert for anonymous users" on analysis_results;
drop policy if exists "Enable select for anyone" on analysis_results;

create policy "Users can create analysis for their own sessions"
on analysis_results for insert
to authenticated
with check (
  exists (
    select 1 from sessions
    where id = analysis_results.session_id
    and user_id = auth.uid()
  )
);

create policy "Users can view analysis of their own sessions"
on analysis_results for select
to authenticated
using (
  exists (
    select 1 from sessions
    where id = analysis_results.session_id
    and user_id = auth.uid()
  )
);
