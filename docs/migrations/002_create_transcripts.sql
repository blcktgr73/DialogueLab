-- Create transcripts table
create table transcripts (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade not null,
  speaker text not null, -- 'user', 'ai', 'partner', etc.
  content text not null,
  timestamp integer default 0, -- seconds from start
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table transcripts enable row level security;

-- Policy: Allow anonymous creation (for MVP)
create policy "Enable insert for anonymous users" on transcripts
  for insert with check (true);

-- Policy: Allow read for anyone (for MVP)
create policy "Enable select for anyone" on transcripts
  for select using (true);

-- Index for faster retrieval by session
create index transcripts_session_id_idx on transcripts(session_id);
