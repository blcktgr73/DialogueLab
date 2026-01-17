-- Create analysis_results table
create table analysis_results (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade not null,
  lens_type text not null, -- 'empathy', 'logic', etc.
  content jsonb not null, -- Structured analysis result
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table analysis_results enable row level security;

-- Policy: Allow anonymous creation (for MVP)
create policy "Enable insert for anonymous users" on analysis_results
  for insert with check (true);

-- Policy: Allow read for anyone (for MVP)
create policy "Enable select for anyone" on analysis_results
  for select using (true);

-- Index for faster retrieval by session
create index analysis_results_session_id_idx on analysis_results(session_id);
