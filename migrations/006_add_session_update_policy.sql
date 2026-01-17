-- Add missing UPDATE policy for sessions table

create policy "Users can update their own sessions"
on sessions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
