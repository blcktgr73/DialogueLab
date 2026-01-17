-- Add UPDATE policy for transcripts table
-- Users should be able to update transcripts if they own the parent session.

create policy "Users can update transcripts of their own sessions"
on transcripts for update
to authenticated
using (
  exists (
    select 1 from sessions
    where id = transcripts.session_id
    and user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from sessions
    where id = transcripts.session_id
    and user_id = auth.uid()
  )
);
